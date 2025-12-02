import type z from "zod";
import Decimal from "decimal.js";
import { PublicKey } from "@solana/web3.js";
import { and, eq, inArray, not } from "drizzle-orm";
import { fromLegacyPublicKey } from "@solana/compat";
import type Coingecko from "@coingecko/coingecko-typescript";
import {
  collectionToMap,
  promiseMapFilter,
  chunkFetchMultipleAccounts,
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
  tickIndexToPrice,
  getTickIndexInArray,
  collectRewardsQuote,
  collectFeesQuote,
  decreaseLiquidityQuote,
  getTickArrayStartTickIndex,
} from "@orca-so/whirlpools-sdk/whirlpools-core";
import {
  getTickArrayAddress,
  getTickArrayDecoder,
  getWhirlpoolDecoder,
  getPositionDecoder,
} from "@orca-so/whirlpools-sdk/whirlpools-client";
import {
  address,
  type Rpc,
  type Address,
  type GetEpochInfoApi,
  type GetMultipleAccountsApi,
  type GetProgramAccountsApi,
  type GetTokenAccountsByOwnerApi,
  type ProgramDerivedAddress,
} from "@solana/kit";

import { getPositionsWhere } from "../shared";

export const syncOrcaPositionsForWallet = async ({
  rpc,
  db,
  coingecko,
  wallet,
}: {
  db: Database;
  coingecko: Coingecko;
  rpc: Rpc<
    GetTokenAccountsByOwnerApi &
      GetMultipleAccountsApi &
      GetProgramAccountsApi &
      GetEpochInfoApi
  >;
  wallet: Pick<z.infer<typeof walletSchema>, "id">;
}) => {
  const walletPositions = await getPositionsWhere(
    db,
    and(
      eq(positions.wallet, wallet.id),
      not(inArray(positions.state, ["closed", "idle"])),
    ),
    "orca",
  );

  return syncOrcaPositions({
    db,
    rpc,
    coingecko,
    walletPositions,
  });
};

export const syncOrcaPositions = async ({
  rpc,
  db,
  coingecko,
  walletPositions,
}: {
  db: Database;
  coingecko: Coingecko;
  walletPositions: Awaited<ReturnType<typeof getPositionsWhere>>;
  rpc: Rpc<
    GetTokenAccountsByOwnerApi &
      GetMultipleAccountsApi &
      GetProgramAccountsApi &
      GetEpochInfoApi
  >;
}) => {
  const positionsMap = collectionToMap(
    walletPositions,
    (position) => position.id,
  );

  if (walletPositions.length < 1) return;
  const positionPubkeys = walletPositions.map((position) =>
    address(position.id),
  );
  const decodePosition = getPositionDecoder();

  const whirlpoolPositions = mapFilter(
    await rpc
      .getMultipleAccounts(positionPubkeys)
      .send()
      .then((response) => response.value),
    (accountInfo, index) => {
      const pubkey = positionPubkeys[index];
      if (accountInfo && pubkey) {
        const [data, encoding] = accountInfo.data;
        return {
          pubkey,
          data: decodePosition.decode(Buffer.from(data, encoding)),
        };
      }
    },
  );
  const whirlpoolIds = new Set(
    whirlpoolPositions.map((position) => position.data.whirlpool),
  );
  const whirpoolCodec = getWhirlpoolDecoder();

  const whirlpoolAccounts = await chunkFetchMultipleAccounts(
    whirlpoolIds.values().toArray(),
    (keys) =>
      rpc
        .getMultipleAccounts(keys)
        .send()
        .then(({ value }) => value),
    (account) => {
      const [data, encoding] = account.data;
      return whirpoolCodec.decode(Buffer.from(data, encoding));
    },
  );

  const whirlpoolAccountsMap = collectionToMap(
    whirlpoolAccounts,
    (account) => account.publicKey,
  );

  const mints = new Set();
  const tickArrayAddresses: Address[] = [];

  const whirlpoolPositionsWithTickAddress = await promiseMapFilter(
    whirlpoolPositions,
    async (position) => {
      const pool = whirlpoolAccountsMap.get(position.data.whirlpool);
      const ticks = [
        position.data.tickLowerIndex,
        position.data.tickUpperIndex,
      ];
      if (!pool) return;

      const [[lowerTickArrayAddress], [upperTickArrayAddress]] =
        (await Promise.all(
          ticks.map((tick) =>
            getTickArrayAddress(
              pool.publicKey,
              getTickArrayStartTickIndex(tick, pool.tickSpacing),
            ),
          ),
        )) as [ProgramDerivedAddress, ProgramDerivedAddress];

      tickArrayAddresses.push(lowerTickArrayAddress, upperTickArrayAddress);

      mints.add(pool.tokenMintA);
      mints.add(pool.tokenMintB);
      for (const rewardInfo of pool.rewardInfos)
        if (fromLegacyPublicKey(PublicKey.default) !== rewardInfo.mint)
          mints.add(rewardInfo.mint);

      return {
        lowerTickArrayAddress,
        upperTickArrayAddress,
        pool,
        ...position,
      };
    },
  );

  if (whirlpoolPositionsWithTickAddress.length < 1) return;

  const tickArrayCodec = getTickArrayDecoder();
  const tickArrays = await chunkFetchMultipleAccounts(
    tickArrayAddresses,
    async (keys) =>
      rpc
        .getMultipleAccounts(keys)
        .send()
        .then(({ value }) => value),
    (account) => {
      const [data, encoding] = account.data;
      return tickArrayCodec.decode(Buffer.from(data, encoding));
    },
  );

  const tickArraysMap = collectionToMap(
    tickArrays,
    (tickArray) => tickArray.publicKey,
  );

  const prices = (await coingecko.simple.tokenPrice.getID("solana", {
    vs_currencies: "usd",
    contract_addresses: Array.from(mints).join(","),
  })) as Record<string, { usd: number }>;

  const pnlUpdates: (typeof pnls.$inferInsert)[] = [];
  const poolUpdates: {
    id: string;
    update: Partial<typeof pools.$inferInsert>;
  }[] = [];
  const positionUpdates: {
    id: string;
    update: Partial<typeof positions.$inferInsert>;
  }[] = [];

  const epochInfo = await rpc.getEpochInfo().send();

  for (const { pool, ...position } of whirlpoolPositionsWithTickAddress) {
    const offchainPosition = positionsMap.get(position.pubkey);
    const lowerTickArray = tickArraysMap.get(position.lowerTickArrayAddress);
    const upperTickArray = tickArraysMap.get(position.upperTickArrayAddress);

    if (!offchainPosition || !lowerTickArray || !upperTickArray) continue;

    const lowerTickState =
      lowerTickArray.ticks[
        getTickIndexInArray(
          position.data.tickLowerIndex,
          getTickArrayStartTickIndex(
            position.data.tickUpperIndex,
            pool.tickSpacing,
          ),
          pool.tickSpacing,
        )
      ]!;
    const upperTickState =
      upperTickArray.ticks[
        getTickIndexInArray(
          position.data.tickUpperIndex,
          getTickArrayStartTickIndex(
            position.data.tickUpperIndex,
            pool.tickSpacing,
          ),
          pool.tickSpacing,
        )
      ]!;
    const active =
      pool.tickCurrentIndex >= position.data.tickLowerIndex &&
      pool.tickCurrentIndex <= position.data.tickUpperIndex;
    const lowerTickPrice = tickIndexToPrice(
      position.data.tickLowerIndex,
      offchainPosition.pool.baseToken.decimals,
      offchainPosition.pool.quoteToken.decimals,
    );
    const upperTickPrice = tickIndexToPrice(
      position.data.tickUpperIndex,
      offchainPosition.pool.baseToken.decimals,
      offchainPosition.pool.quoteToken.decimals,
    );

    const priceRange: [number, number] = [lowerTickPrice, upperTickPrice];

    let baseAmountUsd = 0,
      quoteAmountUsd = 0,
      baseFeeUsd = 0,
      quoteFeeUsd = 0;

    const baseToken = offchainPosition.pool.baseToken;
    const quoteToken = offchainPosition.pool.quoteToken;
    const rewardTokens = offchainPosition.pool.rewardTokens;
    const baseFee = baseToken.extensions?.feeConfig
      ? {
          feeBps:
            baseToken.extensions.feeConfig.newerTransferFee
              .transferFeeBasisPoints,
          maxFee: BigInt(
            baseToken.extensions.feeConfig.newerTransferFee.maximumFee,
          ),
        }
      : undefined;
    const quoteFee = quoteToken.extensions?.feeConfig
      ? {
          feeBps:
            quoteToken.extensions.feeConfig.newerTransferFee
              .transferFeeBasisPoints,
          maxFee: BigInt(
            quoteToken.extensions.feeConfig.newerTransferFee.maximumFee,
          ),
        }
      : undefined;

    const rewardFeesConfigs = rewardTokens.map((reward) =>
      reward.mint.extensions?.feeConfig
        ? {
            feeBps:
              reward.mint.extensions.feeConfig.newerTransferFee
                .transferFeeBasisPoints,
            maxFee: BigInt(
              reward.mint.extensions.feeConfig.newerTransferFee.maximumFee,
            ),
          }
        : undefined,
    );

    const { tokenEstA, tokenEstB } = decreaseLiquidityQuote(
      position.data.liquidity,
      0,
      pool.sqrtPrice,
      position.data.tickLowerIndex,
      position.data.tickUpperIndex,
      baseFee,
      quoteFee,
    );

    const { feeOwedA, feeOwedB } = collectFeesQuote(
      pool,
      position.data,
      lowerTickState,
      upperTickState,
      baseFee,
      quoteFee,
    );
    const { rewards } = collectRewardsQuote(
      pool,
      position.data,
      lowerTickState,
      upperTickState,
      epochInfo.epoch,
      baseFee,
      quoteFee,
      ...rewardFeesConfigs,
    );

    const rawAmountX = tokenEstA.toString();
    const rawFeeX = feeOwedA.toString();
    const rawFeeY = feeOwedB.toString();
    const rawAmountY = tokenEstB.toString();
    const rawRewardAmounts = rewards.map((reward) => reward.rewardsOwed);

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

    const currentPrice = tickIndexToPrice(
      pool.tickCurrentIndex,
      offchainPosition.pool.baseToken.decimals,
      offchainPosition.pool.quoteToken.decimals,
    );

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
            binId: pool.tickCurrentIndex,
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
  if (pnlUpdates.length > 0) {
    const result = await Promise.all([
      db
        .insert(pnls)
        .values(pnlUpdates)
        .onConflictDoUpdate({
          target: [pnls.position],
          set: buildConflictUpdateColumns(pnls, [
            "state",
            "pnlUsd",
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
        db
          .update(positions)
          .set(update)
          .where(eq(positions.id, id))
          .returning(),
      ),
    ]);

    return result.flat(2);
  }
};
