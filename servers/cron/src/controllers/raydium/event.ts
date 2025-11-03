import type z from "zod";
import moment from "moment";
import Decimal from "decimal.js";
import { eq } from "drizzle-orm";
import type { Connection } from "@solana/web3.js";
import type { ProgramEventType } from "@rhiva-ag/decoder";
import type Coingecko from "@coingecko/coingecko-typescript";
import type { AmmV3 } from "@rhiva-ag/decoder/programs/idls/types/raydium";
import {
  type Database,
  type walletSelectSchema,
  positions,
  rewards,
} from "@rhiva-ag/datasource";

import { upsertPool } from "./shared";
import { getPositionById } from "../shared";
import { sendNotification } from "../send-notification";

export const syncRaydiumPositionStateFromEvent = async ({
  db,
  coingecko,
  connection,
  type,
  events,
  wallet,
  positionNftMint: positionId,
  extra: { signature },
}: {
  db: Database;
  connection: Connection;
  coingecko: Coingecko;
  extra: { signature: string };
  events: ProgramEventType<AmmV3>[];
  positionNftMint: string | undefined;
  wallet: Pick<z.infer<typeof walletSelectSchema>, "id" | "user">;
  type?:
    | "closed-position"
    | "create-position"
    | "claim-reward"
    | "rebalance-position";
}) => {
  const results = [];
  const isClosed =
    type && ["closed-position", "rebalance-position"].includes(type);

  for (const event of events) {
    if (event.name === "createPersonalPositionEvent") {
      const data = event.data;
      const pool = await upsertPool(db, connection, data.poolState.toBase58());

      if (pool && positionId) {
        let amountUsd = 0;
        const rawAmountX = data.depositAmount0,
          rawAmountY = data.depositAmount1;
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

          if (baseTokenPrice) amountUsd -= baseTokenPrice * baseAmount;
        }

        if (rawAmountY) {
          quoteAmount = new Decimal(rawAmountY.toString())
            .div(Math.pow(10, pool.quoteToken.decimals))
            .toNumber();

          if (quoteTokenPrice) amountUsd -= quoteTokenPrice * quoteAmount;
        }

        const values: typeof positions.$inferInsert = {
          amountUsd,
          active: true,
          pool: pool.id,
          state: "open",
          wallet: wallet.id,
          status: "successful",
          id: positionId,
          config: {
            history: {
              openPrice: {
                baseToken: baseTokenPrice,
                quoteToken: quoteTokenPrice,
              },
            },
          },
        };

        const [position] = await Promise.all([
          db
            .insert(positions)
            .values(values)
            .onConflictDoNothing({
              target: [positions.id],
            })
            .returning(),
          db.insert(rewards).values({
            user: wallet.user,
            key: "swap",
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

        results.push(position);
      }
    } else if (isClosed && event.name === "decreaseLiquidityEvent") {
      const data = event.data;
      const positionId = data.positionNftMint.toBase58();
      const position = await getPositionById(db, positionId);

      if (!position) return;

      const { pool } = position;
      const price = (await coingecko.simple.tokenPrice.getID("solana", {
        vs_currencies: "usd",
        contract_addresses: [pool.baseToken.id, pool.quoteToken.id].join(","),
      })) as Record<string, { usd: number }>;

      const baseTokenPrice = price[pool.baseToken.id]?.usd;
      const quoteTokenPrice = price[pool.quoteToken.id]?.usd;
      const rawBaseAmount = data.decreaseAmount0;
      const rawQuoteAmount = data.decreaseAmount1;

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
              duration: moment().diff(moment(position.createdAt)),
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
