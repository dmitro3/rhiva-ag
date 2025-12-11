import type { z } from "zod";
import moment from "moment";
import Decimal from "decimal.js";
import type { Address } from "@solana/kit";
import { RaydiumCLMM } from "@rhiva-ag/dex";
import { and, eq, inArray, not } from "drizzle-orm";
import { fromLegacyPublicKey } from "@solana/compat";
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

import { Work } from "../../constants";
import { createQueue, getPositionsWhere } from "../shared";
import type { positionManagerWorkSchema } from "../../schemas";

export const syncRaydiumPositionsForWallet = async ({
  db,
  coingecko,
  connection,
  wallet,
}: {
  db: Database;
  connection: Connection;
  coingecko: Coingecko;
  wallet: Pick<z.infer<typeof walletSchema>, "id">;
}) => {
  const [raydium, walletPositions] = await Promise.all([
    Raydium.load({
      connection,
      owner: new PublicKey(wallet.id),
      disableLoadToken: true,
      disableFeatureCheck: true,
    }),
    getPositionsWhere(
      db,
      and(
        eq(positions.wallet, wallet.id),
        not(inArray(positions.state, ["closed", "idle"])),
      ),
      "raydium-clmm",
    ),
  ]);

  return syncRaydiumPositions({
    db,
    raydium,
    coingecko,
    connection,
    walletPositions,
  });
};

export const syncRaydiumPositions = async ({
  db,
  raydium,
  coingecko,
  connection,
  walletPositions,
}: {
  db: Database;
  raydium: Raydium;
  coingecko: Coingecko;
  connection: Connection;
  walletPositions: Awaited<ReturnType<typeof getPositionsWhere>>;
}) => {
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

  const claimPositions: Address[] = [];
  const inActivePositions: Address[] = [];

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

    // push to position manager queue
    if (!offchainPosition.wallet.external) {
      if (!active) {
        const repositionDeltaTime = moment().diff(
          moment(offchainPosition.config.lastRepositionTime),
        );
        const autoclaimDeltaTime = moment().diff(
          moment(offchainPosition.config.lastRepositionTime),
        );

        if (repositionDeltaTime >= offchainPosition.config.repositionTime)
          inActivePositions.push(fromLegacyPublicKey(position.publicKey));
        if (
          offchainPosition.config.enableAutoClaim &&
          autoclaimDeltaTime >= offchainPosition.config.autoclaimTime
        )
          claimPositions.push(fromLegacyPublicKey(position.publicKey));
      }
    }

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

    let baseAmountUsd = 0,
      quoteAmountUsd = 0,
      baseFeeUsd = 0,
      quoteFeeUsd = 0;

    const baseToken = offchainPosition.pool.baseToken;
    const quoteToken = offchainPosition.pool.quoteToken;
    const rewardTokens = offchainPosition.pool.rewardTokens;

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

    const rawRewardAmounts = PositionUtils.GetPositionRewardsV2(
      pool,
      position,
      lowerTickState!,
      upperTickState!,
    );

    const rawFeeX = tokenFeeAmountA.toString();
    const rawFeeY = tokenFeeAmountB.toString();
    const rawAmountX = amountA.amount.toString();
    const rawAmountY = amountB.amount.toString();

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
    const rewardAmounts = [];
    const rewardAmountsUsd = [];

    for (const [index, rawRewardAmount] of rawRewardAmounts.entries()) {
      const reward = rewardTokens[index];
      if (reward) {
        const rewardAmount = new Decimal(rawRewardAmount.toString())
          .div(Math.pow(10, reward.mint.decimals))
          .toNumber();
        rewardAmounts.push(rewardAmount);
        const price = prices[reward.mint.id]?.usd || 0;
        rewardAmountsUsd.push(price * rewardAmount);
      }
    }

    const tvl = offchainPosition.amountUsd;
    const amountUsd = baseAmountUsd + quoteAmountUsd;
    const totalTVL =
      amountUsd +
      baseFeeUsd +
      quoteFeeUsd +
      rewardAmountsUsd.reduce((acc, reward) => acc + reward, 0);
    const pnlUsd = totalTVL - tvl;

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
      pnlUsd,
      baseAmountUsd,
      quoteAmountUsd,
      state: "opened",
      updatedAt: new Date(),
      baseAmount: amountX,
      quoteAmount: amountY,
      unclaimedBaseFee: feeX,
      unclaimedQuoteFee: feeY,
      position: offchainPosition.id,
      unclaimedBaseFeeUsd: baseFeeUsd,
      unclaimedQuoteFeeUsd: quoteFeeUsd,
      unclaimedRewardsFee: rewardAmounts,
      unclaimedRewardsFeeUsd: rewardAmountsUsd,
    });
  }

  let result = null;

  if (pnlUpdates.length > 0) {
    result = await Promise.all([
      db
        .insert(pnls)
        .values(pnlUpdates)
        .onConflictDoUpdate({
          target: [pnls.position],
          set: buildConflictUpdateColumns(pnls, [
            "state",
            "pnlUsd",
            "updatedAt",
            "baseAmount",
            "quoteAmount",
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
        db
          .update(positions)
          .set(update)
          .where(eq(positions.id, id))
          .returning(),
      ),
    ]);
  }

  const queue = createQueue<z.infer<typeof positionManagerWorkSchema>>(
    Work.positionManager,
  );
  const promises = [];
  if (inActivePositions.length > 0)
    promises.push(
      queue.add(Work.positionManager, {
        dex: "raydium-clmm",
        type: "reposition",
        positions: inActivePositions,
      }),
    );
  if (claimPositions.length > 0)
    promises.push(
      queue.add(Work.positionManager, {
        dex: "raydium-clmm",
        type: "claim",
        positions: claimPositions,
      }),
    );

  await Promise.allSettled(promises);

  return result?.flat(2);
};
