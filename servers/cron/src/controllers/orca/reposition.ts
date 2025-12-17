import type z from "zod";
import pRetry from "p-retry";
import type Dex from "@rhiva-ag/dex";
import { PublicKey } from "@solana/web3.js";
import { fromLegacyPublicKey } from "@solana/compat";
import { repositionOrcaPosition } from "@rhiva-ag/trpc";
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
import { eq } from "drizzle-orm";

// Todo notification alert on reposition failure
export const repositionOrcaPositions = async (
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
        const { execute, positionMint } = await repositionOrcaPosition(
          dex,
          sender,
          fromKeyPairToWalletAdapter(wallet),
          {
            pair: new PublicKey(position.pool.id),
            position: new PublicKey(position.id),
            type: position.config.repositionType,
            slippage: position.wallet.user.settings.slippage * 100,
            jitoConfig: {
              type: "dynamic",
              priorityFeePercentile: "50ema",
            },
          },
        );

        return {
          positionMint,
          bundleId: await execute(),
        };
      };
      const { bundleId, positionMint } = await pRetry(fn, { retries: 4 });

      await queue.add(
        Work.syncTransaction,
        {
          bundleId,
          dex: "orca",
          type: "repositioned",
          positionMint: fromLegacyPublicKey(positionMint),
          wallet: {
            id: position.wallet.id,
            user: position.wallet.user.id,
          },
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
