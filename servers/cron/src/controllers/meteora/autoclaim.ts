import type z from "zod";
import pRetry from "p-retry";
import DLMM from "@meteora-ag/dlmm";
import type Dex from "@rhiva-ag/dex";
import { PublicKey } from "@solana/web3.js";
import {
  collectionToMap,
  fromKeyPairToWalletAdapter,
  type KMSSecret,
  loadWallet,
  type Secret,
  type SendTransaction,
} from "@rhiva-ag/shared";

import { Work } from "../../constants";
import { createQueue } from "../shared";
import type { Position } from "../types";
import type { transactionWorkSchema } from "../../schemas";
import { claimMeteoraReward } from "../../../../trpc/src/index.node";

export const autoclaimMeteoraPositions = async (
  {
    dex,
    secret,
    sender,
  }: {
    dex: Dex;
    sender: SendTransaction;
    secret: KMSSecret | Secret;
  },
  ...positions: Position[]
) => {
  const queue = createQueue<z.infer<typeof transactionWorkSchema>>(
    Work.syncTransaction,
  );
  const pairs = new Set(positions.map((position) => position.pool.id));
  const pools = await DLMM.createMultiple(
    dex.connection,
    Array.from(pairs.values().map((value) => new PublicKey(value))),
  );
  const poolsWithPairPubkey = collectionToMap(pools, (pool) =>
    pool.pubkey.toBase58(),
  );

  return Promise.allSettled(
    positions.map(async (position) => {
      const pool = poolsWithPairPubkey.get(position.pool.id);
      const wallet = await loadWallet(position.wallet, secret);

      if (pool) {
        const fn = async () => {
          const { execute } = await claimMeteoraReward(
            dex,
            sender,
            fromKeyPairToWalletAdapter(wallet),
            {
              pool,
              pair: new PublicKey(position.pool.id),
              position: new PublicKey(position.id),
              jitoConfig: {
                type: "dynamic",
                priorityFeePercentile: "50ema",
              },
              slippage: position.wallet.user.settings.slippage * 100,
            },
          );
          return await execute();
        };
        const bundleId = await pRetry(fn, { retries: 4 });

        return queue.add(
          Work.syncTransaction,
          {
            bundleId,
            dex: "meteora",
            type: "claimed-rewards",
            wallet: {
              id: position.wallet.id,
              user: position.wallet.user.id,
            },
          },
          { jobId: bundleId, deduplication: { id: bundleId } },
        );
      }
    }),
  );
};
