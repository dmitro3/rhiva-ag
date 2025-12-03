import Decimal from "decimal.js";
import { eq } from "drizzle-orm";
import type Coingecko from "@coingecko/coingecko-typescript";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { Whirlpool } from "@rhiva-ag/decoder/programs/idls/types/orca";
import type { ProgramInstructionType, TInstruction } from "@rhiva-ag/decoder";
import {
  getTokenBalanceChangesFromTransactions,
  collectionToMap,
} from "@rhiva-ag/shared";
import {
  PublicKey,
  type Connection,
  type ParsedTransactionWithMeta,
} from "@solana/web3.js";
import {
  buildConflictUpdateColumns,
  pnls,
  positions,
  type Database,
} from "@rhiva-ag/datasource";

import { getPositionsWhere } from "../shared";

export const syncOrcaPositionStateFromInstructions = async ({
  db,
  extra,
  coingecko,
  instructions,
  positionMint,
}: {
  db: Database;
  positionMint: string;
  connection: Connection;
  coingecko: Coingecko;
  extra: { transaction: ParsedTransactionWithMeta };
  instructions: TInstruction<ProgramInstructionType<Whirlpool>>[];
}) => {
  const updatePnls: (typeof pnls.$inferInsert)[] = [];
  const isCollectFeeInstruction = instructions.some(
    (instruction) =>
      ["collectFees", "collectFeesV2"].includes(instruction.parsed.name) &&
      ![
        "closePosition",
        "closeBundledPosition",
        "closePositionWithTokenExtensions",
      ].includes(instruction.parsed.name),
  );

  if (isCollectFeeInstruction) {
    const [[position], pnl] = await Promise.all([
      getPositionsWhere(db, eq(positions.id, positionMint)),
      db.query.pnls.findFirst({
        where: eq(pnls.position, positionMint),
      }),
    ]);

    if (position) {
      await db
        .update(positions)
        .set({
          state: "rebalanced",
          config: {
            ...position.config,
            lastAutoclaimTime: new Date(),
            lastAutocompoundTime: new Date(),
          },
        })
        .where(eq(positions.id, position.id))
        .returning();

      const owner = new PublicKey(position.wallet.id);
      const tokenA = new PublicKey(position.pool.baseToken.id);
      const tokenB = new PublicKey(position.pool.quoteToken.id);
      const tokenAAta = getAssociatedTokenAddressSync(
        tokenA,
        owner,
        false,
        new PublicKey(position.pool.baseToken.tokenProgram),
      );
      const tokenBAta = getAssociatedTokenAddressSync(
        tokenB,
        owner,
        false,
        new PublicKey(position.pool.quoteToken.tokenProgram),
      );

      const rewardAtas = position.pool.rewardTokens.map(({ mint }) =>
        getAssociatedTokenAddressSync(
          new PublicKey(mint.id),
          owner,
          false,
          new PublicKey(mint.tokenProgram),
        ),
      );

      const tokenBalanceChanges = getTokenBalanceChangesFromTransactions({
        skipNativeBalance: false,
        transactions: [extra.transaction],
        accounts: [owner, tokenAAta, tokenBAta, ...rewardAtas],
      });

      const mints = [
        position.pool.baseToken,
        position.pool.quoteToken,
        ...position.pool.rewardTokens.map(({ mint }) => mint),
      ];

      const rewardTokensMap = collectionToMap(
        position.pool.rewardTokens,
        (token) => token.mint.id,
      );

      const prices = (await coingecko.simple.tokenPrice.getID("solana", {
        vs_currencies: "usd",
        contract_addresses: mints.map((mint) => mint.id).join(","),
      })) as Record<string, { usd: number }>;
      const updatePnl = {
        id: pnl?.id,
        position: position.id,
      } as typeof pnls.$inferInsert;

      for (const mint of mints) {
        const rawAmount = tokenBalanceChanges[mint.id];

        if (rawAmount && rawAmount > BigInt(0)) {
          const tokenAmount = new Decimal(rawAmount)
            .div(Math.pow(10, mint.decimals))
            .toNumber();
          const price = prices[mint.id];

          if (price) {
            if (mint.id === position.pool.baseToken.id) {
              updatePnl.unclaimedBaseFee =
                (pnl?.claimedBaseFee ?? 0) + tokenAmount;
              updatePnl.claimedBaseFeeUsd =
                (pnl?.claimedBaseFeeUsd ?? 0) + tokenAmount;
            } else if (mint.id === position.pool.quoteToken.id) {
              updatePnl.claimedQuoteFee =
                (pnl?.claimedQuoteFee ?? 0) + tokenAmount;
              updatePnl.claimedQuoteFeeUsd =
                (pnl?.claimedQuoteFeeUsd ?? 0) + tokenAmount;
            } else if (rewardTokensMap.has(mint.id)) {
              updatePnl.claimedRewardsUsd =
                (pnl?.claimedRewardsUsd ?? 0) + tokenAmount;
            }
          }
        }
      }
      if (updatePnl) updatePnls.push(updatePnl);
    }
  }

  if (updatePnls.length > 0)
    return db
      .insert(pnls)
      .values(updatePnls)
      .onConflictDoUpdate({
        target: [pnls.position],
        set: buildConflictUpdateColumns(pnls, [
          "claimedBaseFee",
          "claimedBaseFeeUsd",
          "claimedQuoteFee",
          "claimedQuoteFeeUsd",
          "claimedRewardsUsd",
        ]),
      })
      .returning()
      .execute();
};
