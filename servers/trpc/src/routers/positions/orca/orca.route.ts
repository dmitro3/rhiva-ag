import Dex from "@rhiva-ag/dex";
import { eq } from "drizzle-orm";
import { Work } from "@rhiva-ag/cron";
import { TRPCError } from "@trpc/server";
import { loadWallet } from "@rhiva-ag/shared";
import { createKeyPairSignerFromBytes } from "@solana/kit";
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
} from "./orca.controller";
import {
  orcaClaimRewardSchema,
  orcaCreatePositionSchema,
  orcaClosePositionSchema,
} from "./orca.schema";

const queue = createQueue();

export const orcaRoute = router({
  create: privateProcedure
    .input(orcaCreatePositionSchema)
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
      const signer = await createKeyPairSignerFromBytes(owner.secretKey);

      const { execute } = await createPosition(
        dex,
        ctx.sendTransaction,
        signer,
        input,
      );

      const bundleId = await execute();
      const response = await queue.add(
        Work.syncTransaction,
        {
          bundleId,
          dex: "orca",
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
    .input(orcaClaimRewardSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.wallet.external)
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "external wallet not supported",
        });

      const dex = new Dex(ctx.connection);
      const owner = await loadWallet(ctx.user.wallet, ctx.secret);
      const signer = await createKeyPairSignerFromBytes(owner.secretKey);

      const { execute } = await claimReward(
        dex,
        ctx.sendTransaction,
        signer,
        input,
      );

      const bundleId = await execute();

      return {
        bundleId,
      };
    }),

  close: privateProcedure
    .input(orcaClosePositionSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.wallet.external)
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "external wallet not supported",
        });

      const dex = new Dex(ctx.connection);
      const owner = await loadWallet(ctx.user.wallet, ctx.secret);
      const signer = await createKeyPairSignerFromBytes(owner.secretKey);
      const { execute } = await closePosition(
        dex,
        ctx.sendTransaction,
        signer,
        input,
      );

      const bundleId = await execute();
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
        const signer = await createKeyPairSignerFromBytes(owner.secretKey);
        const { execute } = await rebalancePosition({
          dex,
          signer,
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
