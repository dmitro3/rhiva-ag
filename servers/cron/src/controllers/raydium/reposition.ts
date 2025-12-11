import type z from "zod";
import pRetry from "p-retry";
import type Dex from "@rhiva-ag/dex";
import { PublicKey } from "@solana/web3.js";
import { fromLegacyPublicKey } from "@solana/compat";
import { repositionRaydiumPosition } from "@rhiva-ag/trpc";
import {
  fromKeyPairToWalletAdapter,
  loadWallet,
  type Secret,
  type KMSSecret,
  type SendTransaction,
} from "@rhiva-ag/shared";

import { Work } from "../../constants";
import { createQueue } from "../shared";
import type { Position } from "../types";
import type { transactionWorkSchema } from "../../schemas";

export const repositionRaydiumPositions = async (
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

      return queue.add(
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
    }),
  );
};
