import Dex from "@rhiva-ag/dex";
import { Work } from "@rhiva-ag/cron";
import { TRPCError } from "@trpc/server";
import type { Address } from "@solana/kit";
import { fromLegacyPublicKey } from "@solana/compat";
import { fromKeyPairToWalletAdapter, loadWallet } from "@rhiva-ag/shared";
import { mints, buildConflictUpdateColumns } from "@rhiva-ag/datasource";

import { createQueue } from "../shared";
import { privateProcedure, router } from "../../../trpc";
import {
  reposition,
  claimReward,
  closePosition,
  createPosition,
} from "./raydium.controller";
import {
  raydiumRepositionSchema,
  raydiumClaimRewardSchema,
  raydiumCreatePositionSchema,
  raydiumClosePositionSchema,
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

      let bundleId: string, positionMint: Address;
      if ("transactions" in input) {
        positionMint = fromLegacyPublicKey(input.positionMint);
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
        const { execute, ...args } = await createPosition(
          dex,
          ctx.sendTransaction,
          wallet,
          input,
        );

        bundleId = await execute();
        positionMint = fromLegacyPublicKey(args.positionMint);
      }
      const response = await queue.add(
        Work.syncTransaction,
        {
          bundleId,
          positionMint,
          dex: "raydium-clmm",
          type: "create-position",
          wallet: ctx.user.wallet,
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
  reposition: privateProcedure
    .input(raydiumRepositionSchema)
    .mutation(async ({ ctx, input }) => {
      let bundleId: string;
      let positionMint: Address;

      if ("transactions" in input) {
        positionMint = fromLegacyPublicKey(input.positionMint);
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
        const { execute, ...args } = await reposition(
          dex,
          ctx.sendTransaction,
          wallet,
          input,
        );

        bundleId = await execute();
        positionMint = fromLegacyPublicKey(args.positionMint);
      }

      const response = await queue.add(
        Work.syncTransaction,
        {
          bundleId,
          positionMint,
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
