import type z from "zod";
import assert from "assert";
import Decimal from "decimal.js";
import { eq } from "drizzle-orm";
import type { Connection } from "@solana/web3.js";
import type { ProgramEventType } from "@rhiva-ag/decoder";
import type Coingecko from "@coingecko/coingecko-typescript";
import type { LbClmm } from "@rhiva-ag/decoder/programs/idls/types/meteora";
import {
  pnls,
  positions,
  rewards,
  type walletSelectSchema,
  type Database,
  settings,
} from "@rhiva-ag/datasource";

import { upsertPool } from "./shared";
import { syncMeteoraPositions } from "./sync";
import { sendNotification } from "../send-notification";
import { getPositionById, getPositionsWhere } from "../shared";
import type { transactionWorkSchema } from "../../workers/schema";

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
  type?: z.infer<typeof transactionWorkSchema>["type"];
  wallet: Pick<z.infer<typeof walletSelectSchema>, "id" | "user">;
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
      const userSettings = await db.query.settings.findFirst({
        where: eq(settings.user, wallet.user),
      });

      assert(userSettings, "userSettings expected not to be null");

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
            lastRepositionTime: new Date(),
            lastAutoclaimTime: new Date(),
            lastAutocompoundTime: new Date(),
            autoclaimTime: userSettings.autoclaimTime,
            repositionType: userSettings.rebalanceType,
            repositionTime: userSettings.rebalanceTime,
            autocompoundTime: userSettings.autoclaimTime,
            enableAutoClaim: userSettings.enableAutoClaim,
            enableAutoCompound: userSettings.enableAutoClaim,
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
            await syncMeteoraPositions({
              db,
              connection,
              coingecko,
              walletPositions: await getPositionsWhere(
                db,
                eq(positions.id, position.id),
              ),
            }),
          ]);
        }
      }
    } else if (closedPosition && event.name === "removeLiquidity") {
      const data = event.data;
      const positionId = data.position.toBase58();
      const position = await getPositionById(db, positionId);

      if (!position || position.state === "closed") return;

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
    } else if (event.name === "rebalancing") {
      const data = event.data;
      const offchainPosition = await getPositionById(
        db,
        data.position.toBase58(),
      );

      if (offchainPosition) {
        const [updatedPosition] = await db
          .update(positions)
          .set({
            state: "rebalanced",
            config: {
              ...offchainPosition.config,
              lastRepositionTime: new Date(),
            },
          })
          .where(eq(positions.id, offchainPosition.id))
          .returning();

        results.push(updatedPosition);
      }
    } else if ("claimFee" === event.name || "claimReward" === event.name) {
      const data = event.data;
      const offchainPosition = await getPositionById(
        db,
        data.position.toBase58(),
      );

      if (offchainPosition) {
        const [updatedPosition] = await db
          .update(positions)
          .set({
            state: "rebalanced",
            config: {
              ...offchainPosition.config,
              lastAutoclaimTime: new Date(),
              lastAutocompoundTime: new Date(),
            },
          })
          .where(eq(positions.id, offchainPosition.id))
          .returning();

        results.push(updatedPosition);
      }
    }
  }

  return results;
};
