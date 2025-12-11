import type z from "zod";
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
import type { transactionWorkSchema } from "../../schemas";
import { claimOrcaReward } from "../../../../trpc/src/index.node";

export const autoclaimOrcaPositions = async (
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
  const pools = await dex.dlmm.orcaLegacy.client.getPools(
    Array.from(pairs.values().map((value) => new PublicKey(value))),
  );
  const poolsWithPairPubkey = collectionToMap(pools, (pool) =>
    pool.getAddress().toBase58(),
  );

  return Promise.allSettled(
    positions.map(async (position) => {
      const pool = poolsWithPairPubkey.get(position.pool.id);
      const wallet = await loadWallet(position.wallet, secret);

      if (pool) {
        const { execute } = await claimOrcaReward(
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
        const bundleId = await execute();

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
