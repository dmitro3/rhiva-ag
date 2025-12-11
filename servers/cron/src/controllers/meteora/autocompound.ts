import type z from "zod";
import assert from "assert";
import { BN } from "bn.js";
import pRetry from "p-retry";
import type Dex from "@rhiva-ag/dex";
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import DLMM, { StrategyType } from "@meteora-ag/dlmm";
import {
  collectionToMap,
  fromKeyPairToWalletAdapter,
  type KMSSecret,
  loadWallet,
  type Secret,
  type SendTransaction,
  getTokenBalanceChangesFromBundleSimulation,
} from "@rhiva-ag/shared";

import { Work } from "../../constants";
import { createQueue } from "../shared";
import type { Position } from "../types";
import type { transactionWorkSchema } from "../../schemas";
import { claimMeteoraReward } from "../../../../trpc/src/index.node";

export const autocompoundMeteoraPositions = async (
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
          const {
            transactions: claimTransactions,
            position: lbPosition,
            bundleSimulationResponse,
          } = await claimMeteoraReward(
            dex,
            sender,
            fromKeyPairToWalletAdapter(wallet),
            {
              pool,
              swapToNative: false,
              pair: new PublicKey(position.pool.id),
              position: new PublicKey(position.id),
              jitoConfig: {
                type: "dynamic",
                priorityFeePercentile: "50ema",
              },
              slippage: position.wallet.user.settings.slippage * 100,
            },
          );

          const tokenBalanceChanges =
            getTokenBalanceChangesFromBundleSimulation(
              bundleSimulationResponse.result.value,
            );
          const totalXAmount =
            tokenBalanceChanges[pool.tokenX.mint.address.toBase58()] ??
            BigInt(0);
          const totalYAmount =
            tokenBalanceChanges[pool.tokenY.mint.address.toBase58()] ??
            BigInt(0);

          assert(
            totalXAmount > BigInt(0) || totalYAmount > BigInt(0),
            "expect amounts > 0",
          );

          const transaction = await pool.addLiquidityByStrategy({
            positionPubKey: lbPosition.publicKey,
            totalXAmount: new BN(totalXAmount),
            totalYAmount: new BN(totalYAmount),

            strategy: {
              strategyType: StrategyType.Spot,
              minBinId: lbPosition.positionData.lowerBinId,
              maxBinId: lbPosition.positionData.upperBinId,
            },
            user: lbPosition.positionData.owner,
          });

          const { blockhash: recentBlockhash } =
            await dex.connection.getLatestBlockhash();
          const v0Message = new TransactionMessage({
            recentBlockhash,
            payerKey: wallet.publicKey,
            instructions: transaction.instructions,
          }).compileToV0Message();
          const addLiquidityV0Transaction = new VersionedTransaction(v0Message);
          addLiquidityV0Transaction.sign([wallet]);

          return sender
            .sendBundle([...claimTransactions, addLiquidityV0Transaction])
            .then(({ result }) => result);
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
