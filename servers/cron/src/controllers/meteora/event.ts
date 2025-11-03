import type z from "zod";
import Decimal from "decimal.js";
import { eq } from "drizzle-orm";
import type { LbClmm } from "@meteora-ag/dlmm";
import type { Connection } from "@solana/web3.js";
import type { ProgramEventType } from "@rhiva-ag/decoder";
import type Coingecko from "@coingecko/coingecko-typescript";
import {
  positions,
  rewards,
  type walletSelectSchema,
  type Database,
} from "@rhiva-ag/datasource";

import { upsertPool } from "./shared";
import { getPositionById } from "../shared";
import { sendNotification } from "../send-notification";

export const syncMeteoraPositionStateFromEvent = async ({
  db,
  coingecko,
  connection,
  events,
  wallet,
  type,
  extra: { signature },
}: {
  db: Database;
  coingecko: Coingecko;
  connection: Connection;
  extra: { signature: string };
  events: ProgramEventType<LbClmm>[];
  wallet: Pick<z.infer<typeof walletSelectSchema>, "id" | "user">;
  type?:
    | "closed-position"
    | "create-position"
    | "claim-reward"
    | "rebalance-position";
}) => {
  const results = [];
  const newPosition =
    type === "create-position" ||
    events.find(({ name }) => name === "positionCreate");
  const closedPosition =
    type === "closed-position" ||
    events.find(({ name }) => name === "positionClose");

  for (const event of events) {
    if (newPosition && event.name === "addLiquidity") {
      const data = event.data;
      const positionId = data.position.toBase58();
      const pool = await upsertPool(db, connection, data.lbPair.toBase58());

      if (pool) {
        const [rawAmountX, rawAmountY] = data.amounts;
        let amountUsd = 0;

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

        const [updatedPosition] = await Promise.all([
          db
            .insert(positions)
            .values(values)
            .onConflictDoNothing({ target: [positions.id] })
            .returning(),
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
        ]);

        results.push(updatedPosition);
      }
    } else if (closedPosition && event.name === "removeLiquidity") {
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

      const [rawBaseAmount, rawQuoteAmount] = data.amounts;
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
