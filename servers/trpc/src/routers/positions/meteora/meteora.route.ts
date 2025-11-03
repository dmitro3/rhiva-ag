import Dex from "@rhiva-ag/dex";
import { eq } from "drizzle-orm";
import { Work } from "@rhiva-ag/cron";
import { TRPCError } from "@trpc/server";
import { loadWallet } from "@rhiva-ag/shared";
import {
  mints,
  positions,
  positionSelectSchema,
  buildConflictUpdateColumns,
} from "@rhiva-ag/datasource";

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

      const dex = new Dex(ctx.connection);
      const owner = await loadWallet(ctx.user.wallet, ctx.secret);
      const { execute } = await createPosition(
        dex,
        ctx.sendTransaction,
        owner,
        input,
      );

      const bundleId = await execute();
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
      const dex = new Dex(ctx.connection);
      const owner = await loadWallet(ctx.user.wallet, ctx.secret);
      const { execute } = await claimReward(
        dex,
        ctx.sendTransaction,
        owner,
        input,
      );

      const bundleId = await execute();

      return {
        bundleId,
      };
    }),
  close: privateProcedure
    .input(meteoraClosePositionSchema)
    .mutation(async ({ ctx, input }) => {
      const dex = new Dex(ctx.connection);
      const owner = await loadWallet(ctx.user.wallet, ctx.secret);
      const { execute } = await closePosition(
        dex,
        ctx.sendTransaction,
        owner,
        input,
      );

      const bundleId = await execute();
      const response = await queue.add(
        Work.syncTransaction,
        {
          bundleId,
          dex: "meteora",
          type: "close-position",
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

        const { execute } = await rebalancePosition({
          dex,
          owner,
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
            type: "rebalance-position",
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
