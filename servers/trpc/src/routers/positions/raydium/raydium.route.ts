import Dex from "@rhiva-ag/dex";
import { eq } from "drizzle-orm";
import { Work } from "@rhiva-ag/cron";
import { TRPCError } from "@trpc/server";
import { fromLegacyPublicKey } from "@solana/compat";
import { fromKeyPairToWalletAdapter, loadWallet } from "@rhiva-ag/shared";
import {
  mints,
  positions,
  positionSelectSchema,
  buildConflictUpdateColumns,
} from "@rhiva-ag/datasource";

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
} from "./raydium.schema";

const queue = createQueue();

export const raydiumRoute = router({
  create: privateProcedure
    .input(raydiumCreatePositionSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.wallet.external)
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "external wallet not supported",
        });

      if (input.tokens)
        await ctx.drizzle
          .insert(mints)
          .values(input.tokens)
          .onConflictDoUpdate({
            target: [mints.id],
            set: buildConflictUpdateColumns(mints, ["name", "symbol", "image"]),
          });
      const dex = new Dex(ctx.connection);
      const owner = await loadWallet(ctx.user.wallet, ctx.secret);
      const wallet = fromKeyPairToWalletAdapter(owner);
      const { positionNftMint, execute } = await createPosition(
        dex,
        ctx.sendTransaction,
        wallet,
        input,
      );

      const bundleId = await execute();
      const response = await queue.add(
        Work.syncTransaction,
        {
          bundleId,
          dex: "raydium-clmm",
          type: "create-position",
          wallet: ctx.user.wallet,
          positionNftMint: fromLegacyPublicKey(positionNftMint),
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
      if (ctx.user.wallet.external)
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "external wallet not supported",
        });

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

      const bundleId = await execute();

      return {
        bundleId,
      };
    }),
  close: privateProcedure
    .input(raydiumClosePositionSchema)
    .mutation(async ({ ctx, input }) => {
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
        wallet,
        ctx.sendTransaction,
        input,
      );

      const bundleId = await execute();
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
    .input(positionSelectSchema.pick({ id: true }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.wallet.external)
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "external wallet not supported",
        });

      const position = await ctx.drizzle.query.positions.findFirst({
        with: {
          pool: {
            with: {
              baseToken: true,
              quoteToken: true,
            },
          },
        },
        where: eq(positions.id, input.id),
      });
      if (position) {
        const dex = new Dex(ctx.connection);
        const owner = await loadWallet(ctx.user.wallet, ctx.secret);
        const wallet = fromKeyPairToWalletAdapter(owner);
        const { execute } = await rebalancePosition({
          dex,
          wallet,
          position,
          sender: ctx.sendTransaction,
          settings: ctx.user.settings,
        });

        const bundleId = await execute();
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
      }

      throw new TRPCError({
        code: "NOT_FOUND",
        message: "position not found.",
      });
    }),
});
