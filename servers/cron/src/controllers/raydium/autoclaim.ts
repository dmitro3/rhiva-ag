import type z from "zod";
import pRetry from "p-retry";
import type Dex from "@rhiva-ag/dex";
import { address } from "@solana/kit";
import { PublicKey } from "@solana/web3.js";
import {
  collectionToMap,
  fromKeyPairToWalletAdapter,
  loadWallet,
  type Secret,
  type KMSSecret,
  type SendTransaction,
} from "@rhiva-ag/shared";

import { Work } from "../../constants";
import { createQueue } from "../shared";
import type { Position } from "../types";
import type { transactionWorkSchema } from "../../external";
import { claimRaydiumReward } from "../../../../trpc/src/index.node";

export const autoclaimRaydiumPositions = async (
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
  const poolInfos = await dex.clmm.raydium.raydium.api.fetchPoolById({
    ids: Array.from(pairs.values()).join(","),
  });
  const poolInfosWithPairPubkey = collectionToMap(poolInfos, (pool) => pool.id);

  return Promise.allSettled(
    positions.map(async (position) => {
      const poolInfo = poolInfosWithPairPubkey.get(position.pool.id);
      const wallet = await loadWallet(position.wallet, secret);

      if (poolInfo) {
        const fn = async () => {
          const { execute } = await claimRaydiumReward(
            dex,
            sender,
            fromKeyPairToWalletAdapter(wallet),
            {
              poolInfo,
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
            dex: "orca",
            type: "claimed-rewards",
            positionMint: address(position.id),
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
