import Dex from "@rhiva-ag/dex";
import { Work } from "@rhiva-ag/cron";
import { TRPCError } from "@trpc/server";
import type { PublicKey } from "@solana/web3.js";
import { fromLegacyPublicKey } from "@solana/compat";
import { fromKeyPairToWalletAdapter, loadWallet } from "@rhiva-ag/shared";
import { mints, buildConflictUpdateColumns } from "@rhiva-ag/datasource";

import { createQueue } from "../shared";
import { privateProcedure, router } from "../../../trpc";
import {
  claimReward,
  closePosition,
  createPosition,
  rebalancePosition,
} from "./raydium.controller";
import {
  raydiumClaimRewardSchema,
  raydiumCreatePositionSchema,
  raydiumClosePositionSchema,
  raydiumRebalanceSchema,
} from "./raydium.schema";

const queue = createQueue();

export const raydiumRoute = router({
  create: privateProcedure
    .input(raydiumCreatePositionSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.tokens)
        await ctx.drizzle
          .insert(mints)
          .values(input.tokens)
          .onConflictDoUpdate({
            target: [mints.id],
            set: buildConflictUpdateColumns(mints, ["name", "symbol", "image"]),
          });

      let bundleId: string, positionNftMint: PublicKey;
      if ("transactions" in input) {
        positionNftMint = input.positionNftMint;
        bundleId = await ctx.sendTransaction
          .sendBundle(input.transactions)
          .then(({ result }) => result);
      } else {
        if (ctx.user.wallet.external)
          throw new TRPCError({
            code: "NOT_IMPLEMENTED",
            message: "external wallet not supported",
          });

        const dex = new Dex(ctx.connection);
        const owner = await loadWallet(ctx.user.wallet, ctx.secret);
        const wallet = fromKeyPairToWalletAdapter(owner);
        const { positionNftMint: mint, execute } = await createPosition(
          dex,
          ctx.sendTransaction,
          wallet,
          input,
        );

        bundleId = await execute();
        positionNftMint = mint;
      }
      const response = await queue.add(
        Work.syncTransaction,
        {
          bundleId,
          dex: "raydium-clmm",
          type: "create-position",
          wallet: ctx.user.wallet,
          positionMint: fromLegacyPublicKey(positionNftMint),
        },
        { jobId: bundleId },
      );

      return {
        jobId: response.id,
        ...response.data,
      };
    }),
  claim: privateProcedure
    .input(raydiumClaimRewardSchema)
    .mutation(async ({ ctx, input }) => {
      let bundleId: string;
      if ("transactions" in input) {
        bundleId = await ctx.sendTransaction
          .sendBundle(input.transactions)
          .then(({ result }) => result);
      } else {
        if (ctx.user.wallet.external)
          throw new TRPCError({
            code: "NOT_IMPLEMENTED",
            message: "external wallet not supported",
          });

        const dex = new Dex(ctx.connection);
        const owner = await loadWallet(ctx.user.wallet, ctx.secret);
        const wallet = fromKeyPairToWalletAdapter(owner);
        const { execute } = await claimReward(
          dex,
          ctx.sendTransaction,
          wallet,
          input,
        );

        bundleId = await execute();
      }

      return {
        bundleId,
      };
    }),
  close: privateProcedure
    .input(raydiumClosePositionSchema)
    .mutation(async ({ ctx, input }) => {
      let bundleId: string;
      if ("transactions" in input) {
        bundleId = await ctx.sendTransaction
          .sendBundle(input.transactions)
          .then(({ result }) => result);
      } else {
        if (ctx.user.wallet.external)
          throw new TRPCError({
            code: "NOT_IMPLEMENTED",
            message: "external wallet not supported",
          });

        const dex = new Dex(ctx.connection);
        const owner = await loadWallet(ctx.user.wallet, ctx.secret);
        const wallet = fromKeyPairToWalletAdapter(owner);
        const { execute } = await closePosition(
          dex,
          ctx.sendTransaction,
          wallet,
          input,
        );

        bundleId = await execute();
      }

      const response = await queue.add(
        Work.syncTransaction,
        {
          bundleId,
          dex: "raydium-clmm",
          type: "closed-position",
          wallet: ctx.user.wallet,
        },
        { jobId: bundleId },
      );

      return {
        jobId: response.id,
        ...response.data,
      };
    }),
  rebalance: privateProcedure
    .input(raydiumRebalanceSchema)
    .mutation(async ({ ctx, input }) => {
      let bundleId: string;
      if ("transactions" in input) {
        bundleId = await ctx.sendTransaction
          .sendBundle(input.transactions)
          .then(({ result }) => result);
      } else {
        if (ctx.user.wallet.external)
          throw new TRPCError({
            code: "NOT_IMPLEMENTED",
            message: "external wallet not supported",
          });

        const dex = new Dex(ctx.connection);
        const owner = await loadWallet(ctx.user.wallet, ctx.secret);
        const wallet = fromKeyPairToWalletAdapter(owner);
        const { execute } = await rebalancePosition(
          dex,
          ctx.sendTransaction,
          wallet,
          input,
        );

        bundleId = await execute();
      }

      const response = await queue.add(
        Work.syncTransaction,
        {
          bundleId,
          dex: "raydium-clmm",
          type: "repositioned",
          wallet: ctx.user.wallet,
        },
        { jobId: bundleId },
      );

      return {
        jobId: response.id,
        ...response.data,
      };
    }),
});
