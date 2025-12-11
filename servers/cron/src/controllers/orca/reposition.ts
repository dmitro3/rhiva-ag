import type z from "zod";
import pRetry from "p-retry";
import type Dex from "@rhiva-ag/dex";
import { PublicKey } from "@solana/web3.js";
import { fromLegacyPublicKey } from "@solana/compat";
import { repositionOrcaPosition } from "@rhiva-ag/trpc";
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

export const repositionOrcaPositions = async (
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

      return queue.add(
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
    }),
  );
};
