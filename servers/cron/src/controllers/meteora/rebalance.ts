import type z from "zod";
import pRetry from "p-retry";
import type Dex from "@rhiva-ag/dex";
import { PublicKey } from "@solana/web3.js";
import { rebalanceMeteoraPosition } from "@rhiva-ag/trpc";
import {
  fromKeyPairToWalletAdapter,
  loadWallet,
  type Secret,
  type KMSSecret,
  type SendTransaction,
} from "@rhiva-ag/shared";

import { Work } from "../../constants";
import type { Position } from "../types";
import { createQueue } from "../shared";
import type { transactionWorkSchema } from "../../external";

export const rebalanceMeteoraPositions = async (
  {
    dex,
    sender,
    secret,
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

  return Promise.allSettled(
    positions.map(async (position) => {
      const wallet = await loadWallet(position.wallet, secret);
      const fn = async () => {
        const { execute } = await rebalanceMeteoraPosition(
          dex,
          sender,
          fromKeyPairToWalletAdapter(wallet),
          {
            type: "swapless",
            pair: new PublicKey(position.pool.id),
            position: new PublicKey(position.id),
            slippage: position.wallet.user.settings.slippage * 100,
            jitoConfig: {
              type: "dynamic",
              priorityFeePercentile: "50ema",
            },
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
          type: "rebalanced-position",
          wallet: {
            id: position.wallet.id,
            user: position.wallet.user.id,
          },
        },
        { jobId: bundleId, deduplication: { id: bundleId } },
      );
    }),
  );
};
