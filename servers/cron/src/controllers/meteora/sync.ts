import Decimal from "decimal.js";
import type { z } from "zod/mini";
import { and, eq, inArray, not } from "drizzle-orm";
import { PublicKey, type Connection } from "@solana/web3.js";
import type Coingecko from "@coingecko/coingecko-typescript";
import DLMM, { getPriceOfBinByBinId } from "@meteora-ag/dlmm";
import { collectionToMap, flatMapFilter } from "@rhiva-ag/shared";
import {
  pnls,
  pools,
  positions,
  buildConflictUpdateColumns,
  type Database,
  type walletSchema,
} from "@rhiva-ag/datasource";

import { fromPricePerLamport } from "./shared";

export const syncMeteoraPositionsForWallet = async (
  db: Database,
  connection: Connection,
  coingecko: Coingecko,
  wallet: Pick<z.infer<typeof walletSchema>, "id">,
) => {
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

  const positionsV2 = await DLMM.getAllLbPairPositionsByUser(
    connection,
    new PublicKey(wallet.id),
  );

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

  for (const { lbPair, ...position } of lbPairWithPositions) {
    const activeBin = lbPair.activeId;

    const offchainPosition = positionsMap.get(position.publicKey.toBase58());
    const [reward1Mint, reward2Mint] = lbPair.rewardInfos.map((rewardInfo) =>
      rewardInfo.mint.toBase58(),
    );

    if (!offchainPosition) continue;

    const { pool } = offchainPosition;

    const active =
      activeBin >= position.positionData.lowerBinId &&
      activeBin <= position.positionData.upperBinId;
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

    let rewardUsd = 0,
      claimedFeeUsd = 0;

    const { baseToken, quoteToken } = offchainPosition.pool;
    const reward1Token = offchainPosition.pool.rewardTokens.find(
      ({ mint }) => mint.id === reward1Mint,
    );
    const reward2Token = offchainPosition.pool.rewardTokens.find(
      ({ mint }) => mint.id === reward2Mint,
    );

    const rawFeeX = position.positionData.feeXExcludeTransferFee.toString();
    const rawFeeY = position.positionData.feeYExcludeTransferFee.toString();
    const rawAmountX =
      position.positionData.totalXAmountExcludeTransferFee.toString();
    const rawAmountY =
      position.positionData.totalYAmountExcludeTransferFee.toString();
    const rawReward1Amount =
      position.positionData.rewardOneExcludeTransferFee.toString();
    const rawReward2Amount =
      position.positionData.rewardTwoExcludeTransferFee.toString();

    const rawClaimedFeeX =
      position.positionData.totalClaimedFeeXAmount.toString();
    const rawClaimedFeeY =
      position.positionData.totalClaimedFeeYAmount.toString();

    let reward1Amount = 0,
      reward2Amount = 0;
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
      quoteFeeUsd = 0;

    if (priceX) {
      baseFeeUsd += priceX * feeX;
      baseAmountUsd += priceX * amountX;
      claimedFeeUsd += priceX * claimedFeeX;
    }

    if (priceY) {
      quoteFeeUsd += priceY * feeY;
      quoteAmountUsd += priceY * amountY;
      claimedFeeUsd += priceY * claimedFeeY;
    }

    if (reward1Token) {
      const priceReward1 = prices[reward1Token.mint.id];
      reward1Amount = new Decimal(rawReward1Amount)
        .div(Math.pow(10, reward1Token.mint.decimals))
        .toNumber();

      if (priceReward1) rewardUsd += priceReward1.usd * reward1Amount;
    }

    if (reward2Token) {
      const priceReward2 = prices[reward2Token.mint.id];
      reward2Amount = new Decimal(rawReward2Amount)
        .div(Math.pow(10, reward2Token.mint.decimals))
        .toNumber();

      if (priceReward2) rewardUsd += priceReward2.usd * reward2Amount;
    }

    const feeUsd = baseFeeUsd + quoteFeeUsd;
    const amountUsd = baseAmountUsd + quoteAmountUsd;
    const tvl = offchainPosition.amountUsd;
    const totalTVL = amountUsd + feeUsd + rewardUsd;
    const pnlUsd = totalTVL - tvl;

    const currentPrice = fromPricePerLamport(
      getPriceOfBinByBinId(lbPair.activeId, lbPair.binStep),
      pool.baseToken.decimals,
      pool.quoteToken.decimals,
    ).toNumber();
    console.log(currentPrice, lbPair.activeId, pnlUpdates, { depth: null });
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
      feeUsd,
      pnlUsd,
      rewardUsd,
      amountUsd,
      claimedFeeUsd,
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
    ...positionUpdates.map(({ id, update }) =>
      db.update(positions).set(update).where(eq(positions.id, id)).returning(),
    ),
  ]);

  return result.flat(2);
};
