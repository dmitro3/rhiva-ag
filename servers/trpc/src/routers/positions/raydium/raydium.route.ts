import Dex from "@rhiva-ag/dex";
import { eq } from "drizzle-orm";
import { Work } from "@rhiva-ag/cron";
import { TRPCError } from "@trpc/server";
import type { PublicKey } from "@solana/web3.js";
import { fromLegacyPublicKey } from "@solana/compat";
import { fromKeyPairToWalletAdapter, loadWallet } from "@rhiva-ag/shared";
import {
  mints,
  positions,
  buildConflictUpdateColumns,
} from "@rhiva-ag/datasource";

import { createQueue } from "../shared";
import { privateProcedure, router } from "../../../trpc";
import { positionRebalanceSchema } from "../position.schema";
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
          wallet,
          ctx.sendTransaction,
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
    .input(positionRebalanceSchema)
    .mutation(async ({ ctx, input }) => {
      const position = await ctx.drizzle.query.positions.findFirst({
        with: {
          pool: {
            with: {
              baseToken: true,
              quoteToken: true,
              rewardTokens: {
                with: {
                  mint: true,
                },
              },
            },
          },
        },
        where: eq(positions.id, input.id),
      });
      if (position) {
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
          const { execute } = await rebalancePosition({
            dex,
            wallet,
            position,
            sender: ctx.sendTransaction,
            settings: ctx.user.settings,
          });

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
      }

      throw new TRPCError({
        code: "NOT_FOUND",
        message: "position not found.",
      });
    }),
});
