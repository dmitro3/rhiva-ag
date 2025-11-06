import BN from "bn.js";
import type { z } from "zod/mini";
import Decimal from "decimal.js";
import { RaydiumCLMM } from "@rhiva-ag/dex";
import { and, eq, inArray, not } from "drizzle-orm";
import { PublicKey, type Connection } from "@solana/web3.js";
import type Coingecko from "@coingecko/coingecko-typescript";
import {
  chunkFetchMultipleAccounts,
  collectionToMap,
  mapFilter,
} from "@rhiva-ag/shared";
import {
  pnls,
  pools,
  positions,
  buildConflictUpdateColumns,
  type Database,
  type walletSchema,
} from "@rhiva-ag/datasource";
import {
  PoolInfoLayout,
  Raydium,
  PositionUtils,
  TickUtils,
  SqrtPriceMath,
  CLMM_PROGRAM_ID,
  TickArrayLayout,
  PositionInfoLayout,
  getPdaPersonalPositionAddress,
} from "@raydium-io/raydium-sdk-v2";

export const syncRaydiumPositionsForWallet = async (
  db: Database,
  connection: Connection,
  coingecko: Coingecko,
  wallet: Pick<z.infer<typeof walletSchema>, "id">,
) => {
  const raydium = await Raydium.load({
    connection,
    owner: new PublicKey(wallet.id),
    disableLoadToken: true,
    disableFeatureCheck: true,
  });
  const walletPositions = await db.query.positions.findMany({
    columns: {
      id: true,
      pool: false,
      config: true,
      amountUsd: true,
    },
    with: {
      pool: {
        columns: {
          baseToken: false,
          quoteToken: false,
          rewardTokens: false,
        },
        with: {
          baseToken: true,
          quoteToken: true,
          rewardTokens: {
            columns: {
              mint: false,
            },
            with: {
              mint: {
                columns: {
                  id: true,
                  decimals: true,
                },
              },
            },
          },
        },
      },
    },
    where: and(
      eq(positions.wallet, wallet.id),
      not(inArray(positions.state, ["closed", "idle"])),
    ),
  });

  const positionsMap = collectionToMap(
    walletPositions,
    (position) => position.id,
  );

  if (walletPositions.length < 1) return;
  const clmmPositions = await chunkFetchMultipleAccounts(
    walletPositions.map(
      (position) =>
        getPdaPersonalPositionAddress(
          CLMM_PROGRAM_ID,
          new PublicKey(position.id),
        ).publicKey,
    ),
    connection.getMultipleAccountsInfo.bind(connection),
    (account) => PositionInfoLayout.decode(account.data),
  );
  const poolIds = new Set(
    clmmPositions.map((position) => position.poolId.toBase58()),
  );
  const poolAccounts = await chunkFetchMultipleAccounts(
    poolIds
      .values()
      .map((poolId) => new PublicKey(poolId))
      .toArray(),
    connection.getMultipleAccountsInfo.bind(connection),
    (account) => PoolInfoLayout.decode(account.data),
  );

  const poolAccountsMap = collectionToMap(poolAccounts, (account) =>
    account.publicKey.toBase58(),
  );

  const mints = new Set();
  const tickArrayAddresses: PublicKey[] = [];

  const clmmPositionsWithTickAddress = mapFilter(clmmPositions, (position) => {
    const pool = poolAccountsMap.get(position.poolId.toBase58());
    const ticks = [position.tickLower, position.tickUpper];
    if (!pool) return;

    const [lowerTickArrayAddress, upperTickArrayAddress] = ticks.map((tick) =>
      TickUtils.getTickArrayAddressByTick(
        CLMM_PROGRAM_ID,
        position.poolId,
        tick,
        pool.tickSpacing,
      ),
    ) as [PublicKey, PublicKey];

    tickArrayAddresses.push(lowerTickArrayAddress, upperTickArrayAddress);

    mints.add(pool.mintA.toBase58());
    mints.add(pool.mintB.toBase58());
    for (const rewardInfo of pool.rewardInfos)
      mints.add(rewardInfo.tokenMint.toBase58());

    return {
      lowerTickArrayAddress,
      upperTickArrayAddress,
      pool,
      ...position,
    };
  });

  if (clmmPositionsWithTickAddress.length < 1) return;

  const tickArraysMap = collectionToMap(
    await chunkFetchMultipleAccounts(
      tickArrayAddresses,
      connection.getMultipleAccountsInfo.bind(connection),
      (account) => TickArrayLayout.decode(account.data),
    ),
    (tickArray) => tickArray.publicKey.toBase58(),
  );

  const prices = (await coingecko.simple.tokenPrice.getID("solana", {
    vs_currencies: "usd",
    contract_addresses: Array.from(mints).join(","),
  })) as Record<string, { usd: number }>;

  const epochInfo = await raydium.fetchEpochInfo();

  const pnlUpdates: (typeof pnls.$inferInsert)[] = [];
  const poolUpdates: {
    id: string;
    update: Partial<typeof pools.$inferInsert>;
  }[] = [];
  const positionUpdates: {
    id: string;
    update: Partial<typeof positions.$inferInsert>;
  }[] = [];

  for (const { pool, ...position } of clmmPositionsWithTickAddress) {
    const lowerTickArray = tickArraysMap.get(
      position.lowerTickArrayAddress.toBase58(),
    );
    const upperTickArray = tickArraysMap.get(
      position.upperTickArrayAddress.toBase58(),
    );
    const offchainPosition = positionsMap.get(position.nftMint.toBase58());

    if (!offchainPosition || !lowerTickArray || !upperTickArray) continue;
    const lowerTickState =
      lowerTickArray.ticks[
        TickUtils.getTickOffsetInArray(position.tickLower, pool.tickSpacing)
      ];
    const upperTickState =
      upperTickArray.ticks[
        TickUtils.getTickOffsetInArray(position.tickUpper, pool.tickSpacing)
      ];
    const active =
      pool.tickCurrent >= position.tickLower &&
      pool.tickCurrent <= position.tickUpper;
    const lowerTickPrice = SqrtPriceMath.sqrtPriceX64ToPrice(
      SqrtPriceMath.getSqrtPriceX64FromTick(position.tickLower),
      offchainPosition.pool.baseToken.decimals,
      offchainPosition.pool.quoteToken.decimals,
    ).toNumber();

    const upperTickPrice = SqrtPriceMath.sqrtPriceX64ToPrice(
      SqrtPriceMath.getSqrtPriceX64FromTick(position.tickUpper),
      offchainPosition.pool.baseToken.decimals,
      offchainPosition.pool.quoteToken.decimals,
    ).toNumber();

    const priceRange: [number, number] = [lowerTickPrice, upperTickPrice];

    let rewardUsd = 0,
      baseAmountUsd = 0,
      quoteAmountUsd = 0,
      baseFeeUsd = 0,
      quoteFeeUsd = 0;

    const baseToken = offchainPosition.pool.baseToken;
    const quoteToken = offchainPosition.pool.quoteToken;
    const [rewardToken] = offchainPosition.pool.rewardTokens;

    const { amountA, amountB } = RaydiumCLMM.getAmountsFromLiquidity({
      epochInfo,
      add: false,
      poolInfo: pool,
      ownerPosition: position,
      liquidity: position.liquidity,
      mintA: { extensions: { feeConfig: baseToken.extensions?.feeConfig } },
      mintB: { extensions: { feeConfig: quoteToken.extensions?.feeConfig } },
    });

    const { tokenFeeAmountA, tokenFeeAmountB } =
      PositionUtils.GetPositionFeesV2(
        pool,
        position,
        lowerTickState!,
        upperTickState!,
      );

    const rewardAmounts = PositionUtils.GetPositionRewardsV2(
      pool,
      position,
      lowerTickState!,
      upperTickState!,
    );

    const rawFeeX = tokenFeeAmountA.toString();
    const rawFeeY = tokenFeeAmountB.toString();
    const rawAmountX = amountA.amount.toString();
    const rawAmountY = amountB.amount.toString();

    const rawRewardAmount = rewardAmounts
      .reduce((acc, curr) => acc.add(curr), new BN(0))
      .toString();

    const feeX = new Decimal(rawFeeX)
      .div(Math.pow(10, baseToken.decimals))
      .toNumber();
    const feeY = new Decimal(rawFeeY)
      .div(Math.pow(10, quoteToken.decimals))
      .toNumber();
    const amountX = new Decimal(rawAmountX)
      .div(Math.pow(10, baseToken.decimals))
      .toNumber();
    const amountY = new Decimal(rawAmountY)
      .div(Math.pow(10, quoteToken.decimals))
      .toNumber();

    const priceX = prices[baseToken.id];
    const priceY = prices[quoteToken.id];

    if (priceX) {
      baseFeeUsd += priceX.usd * feeX;
      baseAmountUsd += priceX.usd * amountX;
    }

    if (priceY) {
      quoteFeeUsd += priceY.usd * feeY;
      quoteAmountUsd += priceY.usd * amountY;
    }

    if (rewardToken) {
      const rewardAmount = new Decimal(rawRewardAmount)
        .div(Math.pow(10, rewardToken.mint.decimals))
        .toNumber();

      const priceReward = prices[rewardToken.mint.id];
      if (priceReward) rewardUsd += priceReward.usd * rewardAmount;
    }

    const feeUsd = baseFeeUsd + quoteFeeUsd;
    const amountUsd = baseAmountUsd + quoteAmountUsd;
    const tvl = offchainPosition.amountUsd;
    const totalTVL = amountUsd + feeUsd + rewardUsd;
    const pnlUsd = tvl - totalTVL;

    const currentPrice = SqrtPriceMath.sqrtPriceX64ToPrice(
      SqrtPriceMath.getSqrtPriceX64FromTick(pool.tickCurrent),
      offchainPosition.pool.baseToken.decimals,
      offchainPosition.pool.quoteToken.decimals,
    ).toNumber();

    positionUpdates.push({
      id: offchainPosition.id,
      update: { active, config: { ...offchainPosition.config, priceRange } },
    });
    poolUpdates.push({
      id: offchainPosition.pool.id,
      update: {
        config: {
          ...offchainPosition.pool.config,
          extra: {
            currentPrice,
            binId: pool.tickCurrent,
          },
        },
      },
    });
    pnlUpdates.push({
      feeUsd,
      pnlUsd,
      rewardUsd,
      amountUsd,
      claimedFeeUsd: 0,
      state: "opened",
      baseAmountUsd,
      quoteAmountUsd,
      baseAmount: amountX,
      quoteAmount: amountY,
      unclaimedBaseFee: feeX,
      unclaimedQuoteFee: feeY,
      unclaimedBaseFeeUsd: baseFeeUsd,
      unclaimedQuoteFeeUsd: quoteFeeUsd,
      position: offchainPosition.id,
    });
  }

  const result = await Promise.all([
    db
      .insert(pnls)
      .values(pnlUpdates)
      .onConflictDoUpdate({
        target: [pnls.position, pnls.createdAt],
        set: buildConflictUpdateColumns(pnls, [
          "state",
          "feeUsd",
          "pnlUsd",
          "rewardUsd",
          "amountUsd",
          "baseAmount",
          "quoteAmount",
          "claimedFeeUsd",
          "baseAmountUsd",
          "quoteAmountUsd",
          "unclaimedBaseFee",
          "unclaimedQuoteFee",
          "unclaimedBaseFeeUsd",
          "unclaimedQuoteFeeUsd",
        ]),
      })
      .returning(),
    ...poolUpdates.map(({ id, update }) =>
      db.update(pools).set(update).where(eq(pools.id, id)).returning(),
    ),
    ...positionUpdates.flatMap(({ id, update }) =>
      db.update(positions).set(update).where(eq(positions.id, id)).returning(),
    ),
  ]);

  return result.flat(2);
};
