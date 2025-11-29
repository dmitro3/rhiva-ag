import type z from "zod";
import moment from "moment";
import Decimal from "decimal.js";
import { eq } from "drizzle-orm";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import type { ProgramEventType } from "@rhiva-ag/decoder";
import type Coingecko from "@coingecko/coingecko-typescript";
import { PublicKey, type Connection } from "@solana/web3.js";
import type { AmmV3 } from "@rhiva-ag/decoder/programs/idls/types/raydium";
import {
  type Database,
  type walletSelectSchema,
  pnls,
  positions,
  rewards,
} from "@rhiva-ag/datasource";

import { upsertPool } from "./shared";
import { syncRaydiumPositions } from "./sync";
import { sendNotification } from "../send-notification";
import { getPositionById, getPositionsWhere } from "../shared";
import type { transactionWorkSchema } from "../../workers/transaction.worker";

export const syncRaydiumPositionStateFromEvent = async ({
  db,
  coingecko,
  connection,
  type,
  events,
  wallet,
  positionMint,
  extra: { signature },
}: {
  db: Database;
  connection: Connection;
  coingecko: Coingecko;
  extra: { signature: string };
  events: ProgramEventType<AmmV3>[];
  positionMint: string | undefined;
  type?: z.infer<typeof transactionWorkSchema>["type"];
  wallet: Pick<z.infer<typeof walletSelectSchema>, "id" | "user">;
}) => {
  const results = [];
  const isClosed = type && ["closed-position", "repositioned"].includes(type);

  for (const event of events) {
    if (event.name === "createPersonalPositionEvent") {
      const data = event.data;
      const pool = await upsertPool(db, connection, data.poolState.toBase58());

      if (pool && positionMint) {
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
          active: true,
          pool: pool.id,
          state: "open",
          wallet: wallet.id,
          status: "successful",
          id: positionMint,
          config: {
            history: {
              openPrice: {
                baseToken: baseTokenPrice,
                quoteToken: quoteTokenPrice,
              },
            },
          },
        };
        const isRebalanced = type === "rebalanced-position";

        const [position] = await db
          .insert(positions)
          .values(values)
          .onConflictDoNothing({
            target: [positions.id],
          })
          .returning();

        if (position) {
          results.push(position);
          await Promise.allSettled([
            db.insert(rewards).values({
              user: wallet.user,
              key: "swap",
              xp: Math.floor(amountUsd),
            }),
            sendNotification(db, {
              user: wallet.user,
              type: "transactions",
              title: {
                external: true,
                text: isRebalanced
                  ? "position.repositioned"
                  : "position.created",
              },
              detail: {
                external: true,
                text: isRebalanced
                  ? "position.repositioned"
                  : "position.created",
                params: {
                  signature,
                  position: positionMint,
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
            async () => {
              const raydium = await Raydium.load({
                connection,
                disableLoadToken: true,
                disableFeatureCheck: true,
                owner: new PublicKey(wallet.id),
              });
              await syncRaydiumPositions({
                db,
                raydium,
                connection,
                coingecko,
                walletPositions: await getPositionsWhere(
                  db,
                  eq(positions.id, position.id),
                ),
              });
            },
          ]);
        }
      }
    } else if (isClosed && event.name === "decreaseLiquidityEvent") {
      const data = event.data;
      const positionId = data.positionNftMint.toBase58();
      const position = await getPositionById(db, positionId);

      if (!position || position.state === "closed") return;

      const { pool } = position;
      const price = (await coingecko.simple.tokenPrice.getID("solana", {
        vs_currencies: "usd",
        contract_addresses: [pool.baseToken.id, pool.quoteToken.id].join(","),
      })) as Record<string, { usd: number }>;

      const rawBaseAmount = data.decreaseAmount0;
      const rawQuoteAmount = data.decreaseAmount1;
      const baseTokenPrice = price[pool.baseToken.id]?.usd;
      const quoteTokenPrice = price[pool.quoteToken.id]?.usd;

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
              ...position.config,
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
        db
          .update(pnls)
          .set({ state: "closed" })
          .where(eq(pnls.position, positionId))
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
    } else if (event.name === "collectPersonalFeeEvent") {
      // todo
    }
  }

  return results;
};
