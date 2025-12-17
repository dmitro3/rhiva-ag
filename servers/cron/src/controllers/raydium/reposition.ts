import type z from "zod";
import pRetry from "p-retry";
import { eq } from "drizzle-orm";
import type Dex from "@rhiva-ag/dex";
import { PublicKey } from "@solana/web3.js";
import { fromLegacyPublicKey } from "@solana/compat";
import { repositionRaydiumPosition } from "@rhiva-ag/trpc";
import { positions, type Database } from "@rhiva-ag/datasource";
import {
  loadWallet,
  fromKeyPairToWalletAdapter,
  type Secret,
  type KMSSecret,
  type SendTransaction,
} from "@rhiva-ag/shared";

import { Work } from "../../constants";
import { createQueue } from "../shared";
import type { Position } from "../types";
import type { transactionWorkSchema } from "../../schemas";

// Todo notification alert on reposition failure
export const repositionRaydiumPositions = async (
  {
    db,
    dex,
    sender,
    secret,
  }: {
    dex: Dex;
    db: Database;
    sender: SendTransaction;
    secret: KMSSecret | Secret;
  },
  ...allPositions: Position[]
) => {
  const queue = createQueue<z.infer<typeof transactionWorkSchema>>(
    Work.syncTransaction,
  );
  const results = await Promise.allSettled(
    allPositions.map(async (position) => {
      const wallet = await loadWallet(position.wallet, secret);
      const fn = async () => {
        const { execute, positionMint } = await repositionRaydiumPosition(
          dex,
          sender,
          fromKeyPairToWalletAdapter(wallet),
          {
            type: position.wallet.user.settings.rebalanceType,
            slippage: position.wallet.user.settings.slippage * 100,
            pair: new PublicKey(position.pool.id),
            position: new PublicKey(position.id),
            jitoConfig: {
              type: "dynamic",
              priorityFeePercentile: "50ema",
            },
          },
        );

        return { positionMint, bundleId: await execute() };
      };

      const { bundleId, positionMint } = await pRetry(fn, { retries: 4 });

      await queue.add(
        Work.syncTransaction,
        {
          bundleId,
          dex: "raydium-clmm",
          type: "repositioned",
          wallet: {
            id: position.wallet.id,
            user: position.wallet.user.id,
          },
          positionMint: fromLegacyPublicKey(positionMint),
        },
        { jobId: bundleId, deduplication: { id: bundleId } },
      );

      return position;
    }),
  );

  return db.transaction(async (db) => {
    return Promise.all(
      results.map((result) => {
        if (result.status === "fulfilled")
          return db
            .update(positions)
            .set({
              state: "repositioned",
              status: "successful",
              config: {
                ...result.value.config,
                lastRepositionTime: new Date(),
              },
            })
            .where(eq(positions.id, result.value.id))
            .returning()
            .execute();

        return null;
      }),
    );
  });
};
