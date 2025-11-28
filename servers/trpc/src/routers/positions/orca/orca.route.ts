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
  claimReward,
  closePosition,
  createPosition,
  rebalancePosition,
} from "./orca-legacy.controller";
import {
  orcaClaimRewardSchema,
  orcaCreatePositionSchema,
  orcaClosePositionSchema,
  orcaRebalanceSchema,
} from "./orca.schema";

const queue = createQueue();

export const orcaRoute = router({
  create: privateProcedure
    .input(orcaCreatePositionSchema)
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
        positionMint = input.positionMint;
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
        const owner = fromKeyPairToWalletAdapter(
          await loadWallet(ctx.user.wallet, ctx.secret),
        );
        const { execute, positionMint: _positionMint } = await createPosition(
          dex,
          ctx.sendTransaction,
          owner,
          input,
        );

        bundleId = await execute();
        positionMint = fromLegacyPublicKey(_positionMint);
      }
      const response = await queue.add(
        Work.syncTransaction,
        {
          bundleId,
          dex: "orca",
          type: "create-position",
          wallet: ctx.user.wallet,
          positionMint: positionMint,
        },
        { jobId: bundleId },
      );

      return {
        jobId: response.id,
        ...response.data,
      };
    }),
  claim: privateProcedure
    .input(orcaClaimRewardSchema)
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
        const owner = fromKeyPairToWalletAdapter(
          await loadWallet(ctx.user.wallet, ctx.secret),
        );

        const { execute } = await claimReward(
          dex,
          ctx.sendTransaction,
          owner,
          input,
        );

        bundleId = await execute();
      }

      return {
        bundleId,
      };
    }),

  close: privateProcedure
    .input(orcaClosePositionSchema)
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
        const owner = fromKeyPairToWalletAdapter(
          await loadWallet(ctx.user.wallet, ctx.secret),
        );

        const { execute } = await closePosition(
          dex,
          ctx.sendTransaction,
          owner,
          input,
        );

        bundleId = await execute();
      }

      const response = await queue.add(
        Work.syncTransaction,
        {
          bundleId,
          dex: "orca",
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
    .input(orcaRebalanceSchema)
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
        const wallet = fromKeyPairToWalletAdapter(
          await loadWallet(ctx.user.wallet, ctx.secret),
        );

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
