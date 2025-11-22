import Decimal from "decimal.js";
import { eq } from "drizzle-orm";
import type { z } from "zod/mini";
import type { Rpc, SolanaRpcApi } from "@solana/kit";
import type { ProgramEventType } from "@rhiva-ag/decoder";
import type Coingecko from "@coingecko/coingecko-typescript";
import type { Whirlpool } from "@rhiva-ag/decoder/programs/idls/types/orca";
import {
  rewards,
  positions,
  type Database,
  type walletSelectSchema,
} from "@rhiva-ag/datasource";

import { upsertPool } from "./shared";
import { syncOrcaPositions } from "./sync";
import { sendNotification } from "../send-notification";
import { getPositionById, getPositionsWhere } from "../shared";
import type { transactionWorkSchema } from "../../workers/transaction.worker";

export const syncOrcaPositionStateFromEvent = async ({
  db,
  rpc,
  coingecko,
  wallet,
  events,
  type,
  extra: { signature },
}: {
  db: Database;
  rpc: Rpc<SolanaRpcApi>;
  coingecko: Coingecko;
  positionMint?: string;
  extra: { signature: string };
  events: ProgramEventType<Whirlpool>[];
  type?: z.infer<typeof transactionWorkSchema>["type"];
  wallet: Pick<z.infer<typeof walletSelectSchema>, "id" | "user">;
}) => {
  const results = [];
  const isClosed = type && ["closed-position", "repositioned"].includes(type);

  for (const event of events) {
    if (event.name === "liquidityIncreased" && type === "create-position") {
      const data = event.data;
      const positionId = data.position.toBase58();
      const pool = await upsertPool(db, rpc, data.whirlpool.toBase58());

      if (pool) {
        let amountUsd = 0;
        const rawAmountX = data.tokenAAmount,
          rawAmountY = data.tokenBAmount;

        const price = (await coingecko.simple.tokenPrice.getID("solana", {
          vs_currencies: "usd",
          contract_addresses: [pool.baseToken.id, pool.quoteToken.id].join(","),
        })) as Record<string, { usd: number }>;

        const baseTokenPrice = price[pool.baseToken.id]?.usd;
        const quoteTokenPrice = price[pool.quoteToken.id]?.usd;

        let baseAmount = 0,
          quoteAmount = 0;
        if (rawAmountX) {
          baseAmount = new Decimal(rawAmountX.toString())
            .div(Math.pow(10, pool.baseToken.decimals))
            .toNumber();

          if (baseTokenPrice) amountUsd += baseTokenPrice * baseAmount;
        }

        if (rawAmountY) {
          quoteAmount = new Decimal(rawAmountY.toString())
            .div(Math.pow(10, pool.quoteToken.decimals))
            .toNumber();

          if (quoteTokenPrice) amountUsd += quoteTokenPrice * quoteAmount;
        }

        const values: typeof positions.$inferInsert = {
          amountUsd,
          pool: pool.id,
          id: positionId,
          state: "open",
          status: "successful",
          active: true,
          wallet: wallet.id,
          config: {
            history: {
              openPrice: {
                baseToken: baseTokenPrice,
                quoteToken: quoteTokenPrice,
              },
            },
          },
        };
        const [position] = await db
          .insert(positions)
          .values(values)
          .onConflictDoNothing({ target: [positions.id] })
          .returning();
        if (position) {
          results.push(position);
          await Promise.allSettled([
            db.insert(rewards).values({
              key: "swap",
              user: wallet.user,
              xp: Math.floor(amountUsd),
            }),
            sendNotification(db, {
              user: wallet.user,
              type: "transactions",
              title: { external: true, text: "position.created" },
              detail: {
                external: true,
                text: "position.created",
                params: {
                  signature,
                  position: positionId,
                  baseToken: {
                    amount: baseAmount,
                    price: baseTokenPrice,
                    symbol: pool.baseToken.symbol,
                  },
                  quoteToken: {
                    amount: quoteAmount,
                    price: quoteTokenPrice,
                    symbol: pool.quoteToken.symbol,
                  },
                },
              },
            }),
            syncOrcaPositions({
              rpc,
              coingecko,
              db,
              walletPositions: await getPositionsWhere(
                db,
                eq(positions.id, position.id),
              ),
            }),
          ]);
        }
      }
    } else if (isClosed && event.name === "liquidityDecreased") {
      const data = event.data;
      const positionId = data.position.toBase58();
      const position = await getPositionById(db, positionId);

      if (!position) return;

      const { pool } = position;
      const price = (await coingecko.simple.tokenPrice.getID("solana", {
        vs_currencies: "usd",
        contract_addresses: [pool.baseToken.id, pool.quoteToken.id].join(","),
      })) as Record<string, { usd: number }>;

      const baseTokenPrice = price[pool.baseToken.id]?.usd;
      const quoteTokenPrice = price[pool.quoteToken.id]?.usd;
      const rawBaseAmount = data.tokenAAmount;
      const rawQuoteAmount = data.tokenBAmount;

      let baseAmount = 0,
        quoteAmount = 0;
      if (rawBaseAmount)
        baseAmount = new Decimal(rawBaseAmount.toString())
          .div(Math.pow(10, pool.baseToken.decimals))
          .toNumber();
      if (rawQuoteAmount)
        quoteAmount = new Decimal(rawQuoteAmount.toString())
          .div(Math.pow(10, pool.quoteToken.decimals))
          .toNumber();

      const [updatedPosition] = await Promise.all([
        db
          .update(positions)
          .set({
            state: "closed",
            config: {
              ...positions.config,
              history: {
                ...position.config.history,
                closingPrice: {
                  baseToken: baseTokenPrice,
                  quoteToken: quoteTokenPrice,
                },
              },
            },
          })
          .where(eq(positions.id, positionId))
          .returning(),
        sendNotification(db, {
          user: wallet.user,
          type: "transactions",
          title: { external: true, text: "position.closed" },
          detail: {
            external: true,
            text: "position.closed",
            params: {
              signature,
              position: positionId,
              baseToken: {
                amount: baseAmount,
                price: baseTokenPrice,
                symbol: pool.baseToken.symbol,
              },
              quoteToken: {
                amount: quoteAmount,
                price: quoteTokenPrice,
                symbol: pool.quoteToken.symbol,
              },
            },
          },
        }),
      ]);

      results.push(updatedPosition);
    }
  }

  return results;
};
