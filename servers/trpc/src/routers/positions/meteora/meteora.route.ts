import Dex from "@rhiva-ag/dex";
import { Work } from "@rhiva-ag/cron";
import { TRPCError } from "@trpc/server";
import { fromKeyPairToWalletAdapter, loadWallet } from "@rhiva-ag/shared";
import { mints, buildConflictUpdateColumns } from "@rhiva-ag/datasource";

import { createQueue } from "../shared";
import { privateProcedure, router } from "../../../trpc";
import {
  closePosition,
  createPosition,
  claimReward,
  rebalancePosition,
} from "./meteora.controller";
import {
  meteoraCreatePositionSchema,
  meteoraClosePositionSchema,
  meteoraClaimRewardSchema,
  meteoraRebalanceSchema,
} from "./meteora.schema";

const queue = createQueue();

export const meteoraRoute = router({
  create: privateProcedure
    .input(meteoraCreatePositionSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.tokens)
        await ctx.drizzle
          .insert(mints)
          .values(input.tokens)
          .onConflictDoUpdate({
            target: [mints.id],
            set: buildConflictUpdateColumns(mints, ["name", "symbol", "image"]),
          });

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
        const { execute } = await createPosition(
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
          dex: "meteora",
          type: "create-position",
          wallet: ctx.user.wallet,
        },
        {
          jobId: bundleId,
        },
      );

      return {
        jobId: response.id,
        ...response.data,
      };
    }),
  claim: privateProcedure
    .input(meteoraClaimRewardSchema)
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
    .input(meteoraClosePositionSchema)
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
          dex: "meteora",
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
    .input(meteoraRebalanceSchema)
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
          wallet: ctx.user.wallet,
          type: "rebalanced-position",
        },
        { jobId: bundleId },
      );

      return {
        jobId: response.id,
        ...response.data,
      };
    }),
});
