import moment from "moment";
import Decimal from "decimal.js";
import type { z } from "zod/mini";
import { and, eq, inArray, not } from "drizzle-orm";
import { flatMapFilter, mapFilter } from "@rhiva-ag/shared";
import { PublicKey, type Connection } from "@solana/web3.js";
import type Coingecko from "@coingecko/coingecko-typescript";
import DLMM, { getPriceOfBinByBinId } from "@meteora-ag/dlmm";
import {
  pnls,
  pools,
  positions,
  buildConflictUpdateColumns,
  type Database,
  type walletSchema,
} from "@rhiva-ag/datasource";

import { Work } from "../../constants";
import { fromPricePerLamport } from "./shared";
import { createQueue, getPositionsWhere } from "../shared";

export const syncMeteoraPositionsForWallet = async ({
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
  const walletPositions = await getPositionsWhere(
    db,
    and(
      eq(positions.wallet, wallet.id),
      not(inArray(positions.state, ["closed", "idle"])),
    ),
    "meteora",
  );

  return syncMeteoraPositions({
    db,
    coingecko,
    connection,
    walletPositions,
  });
};

export const syncMeteoraPositions = async ({
  db,
  coingecko,
  connection,
  walletPositions,
}: {
  db: Database;
  coingecko: Coingecko;
  connection: Connection;
  walletPositions: Awaited<ReturnType<typeof getPositionsWhere>>;
}) => {
  const positionsMap = new Map<
    string,
    Awaited<ReturnType<typeof getPositionsWhere>>[number]
  >();
  const positionPubkeys: PublicKey[] = [];

  for (const position of walletPositions) {
    positionsMap.set(position.id, position);
    positionPubkeys.push(new PublicKey(position.id));
  }

  if (walletPositions.length < 1) return;

  const positionsV2 = await DLMM.processPositions(
    connection,
    mapFilter(
      await connection.getMultipleAccountsInfo(positionPubkeys),
      (account, index) => {
        const pubkey = positionPubkeys[index];
        if (pubkey && account) {
          return {
            pubkey,
            account,
          };
        }
      },
    ),
  );

  if (positionsV2.size < 1) return;

  const mints = new Set();
  const lbPairWithPositions = flatMapFilter(
    positionsV2.values().toArray(),
    ({ lbPair, lbPairPositionsData, publicKey }) => {
      mints.add(lbPair.tokenXMint.toBase58());
      mints.add(lbPair.tokenYMint.toBase58());
      for (const rewardInfo of lbPair.rewardInfos)
        if (!PublicKey.default.equals(rewardInfo.mint))
          mints.add(rewardInfo.mint.toBase58());

      return lbPairPositionsData.map((lbPairPositionsData) => ({
        ...lbPairPositionsData,
        lbPair: { publicKey, ...lbPair },
      }));
    },
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

  const inActivePositions: PublicKey[] = [];

  for (const { lbPair, ...position } of lbPairWithPositions) {
    const activeBin = lbPair.activeId;

    const offchainPosition = positionsMap.get(position.publicKey.toBase58());

    if (!offchainPosition) continue;

    const { pool } = offchainPosition;

    const active =
      activeBin >= position.positionData.lowerBinId &&
      activeBin <= position.positionData.upperBinId;

    if (!active && !offchainPosition.wallet.external) {
      const deltaTime = moment().diff(
        moment(offchainPosition.config.lastRepositionTime),
      );
      if (deltaTime >= offchainPosition.config.repositionTime)
        inActivePositions.push(position.publicKey);
    }

    const lowerBinPrice = fromPricePerLamport(
      getPriceOfBinByBinId(position.positionData.lowerBinId, lbPair.binStep),
      pool.baseToken.decimals,
      pool.quoteToken.decimals,
    ).toNumber();
    const upperBinPrice = fromPricePerLamport(
      getPriceOfBinByBinId(position.positionData.upperBinId, lbPair.binStep),
      pool.baseToken.decimals,
      pool.quoteToken.decimals,
    ).toNumber();
    const priceRange: [number, number] = [lowerBinPrice, upperBinPrice];

    const { baseToken, quoteToken } = offchainPosition.pool;
    const rewardTokens = offchainPosition.pool.rewardTokens;

    const rawFeeX = position.positionData.feeXExcludeTransferFee.toString();
    const rawFeeY = position.positionData.feeYExcludeTransferFee.toString();
    const rawAmountX =
      position.positionData.totalXAmountExcludeTransferFee.toString();
    const rawAmountY =
      position.positionData.totalYAmountExcludeTransferFee.toString();

    const rawRewardAmounts = [
      position.positionData.rewardOneExcludeTransferFee,
      position.positionData.rewardTwoExcludeTransferFee,
    ];

    const rawClaimedFeeX =
      position.positionData.totalClaimedFeeXAmount.toString();
    const rawClaimedFeeY =
      position.positionData.totalClaimedFeeYAmount.toString();

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
    const claimedFeeX = new Decimal(rawClaimedFeeX)
      .div(Math.pow(10, baseToken.decimals))
      .toNumber();
    const claimedFeeY = new Decimal(rawClaimedFeeY)
      .div(Math.pow(10, quoteToken.decimals))
      .toNumber();

    const priceX = prices[baseToken.id]?.usd;
    const priceY = prices[quoteToken.id]?.usd;

    let baseAmountUsd = 0,
      quoteAmountUsd = 0,
      baseFeeUsd = 0,
      quoteFeeUsd = 0,
      claimedFeeXUsd = 0,
      claimedFeeYUsd = 0;

    if (priceX) {
      baseFeeUsd += priceX * feeX;
      baseAmountUsd += priceX * amountX;
      claimedFeeXUsd += priceX * claimedFeeX;
    }

    if (priceY) {
      quoteFeeUsd += priceY * feeY;
      quoteAmountUsd += priceY * amountY;
      claimedFeeYUsd += priceY * claimedFeeY;
    }

    const rewardAmounts: number[] = [];
    const rewardAmountsUsd: number[] = [];

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

    const currentPrice = fromPricePerLamport(
      getPriceOfBinByBinId(lbPair.activeId, lbPair.binStep),
      pool.baseToken.decimals,
      pool.quoteToken.decimals,
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
            binId: lbPair.activeId,
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
      claimedBaseFee: claimedFeeX,
      claimedQuoteFee: claimedFeeY,
      claimedBaseFeeUsd: claimedFeeXUsd,
      claimedQuoteFeeUsd: claimedFeeYUsd,
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
            "claimedFeeUsd",
            "claimedBaseFee",
            "claimedQuoteFee",
            "claimedBaseFeeUsd",
            "claimedQuoteFeeUsd",
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
      ...positionUpdates.map(({ id, update }) =>
        db
          .update(positions)
          .set(update)
          .where(eq(positions.id, id))
          .returning(),
      ),
    ]);
  }

  if (inActivePositions.length > 0) {
    const queue = createQueue(Work.positionManager);
    queue.add(Work.positionManager, {
      dex: "meteora",
      positions: inActivePositions,
    });
  }

  return result?.flat(2);
};
