import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  walletInsertSchema,
  wallets,
  walletSchema,
} from "@rhiva-ag/datasource";

import { safeWalletSchema } from "./wallet.schema";
import { router, privateProcedure } from "../../trpc";
import { createWallet } from "../../controllers/wallet.controller";

export const walletRoute = router({
  create: privateProcedure
    .input(walletInsertSchema.pick({ id: true, primary: true }).partial())
    .output(safeWalletSchema)
    .mutation(async ({ ctx, input }) => {
      const wallet = await createWallet(
        ctx.drizzle,
        ctx.secret,
        {
          ...input,
          user: ctx.user.id,
        },
        { updatePrimary: true },
      );
      if (wallet) return wallet;

      throw new TRPCError({
        code: "UNPROCESSABLE_CONTENT",
        message: "wallet not created",
      });
    }),
  update: privateProcedure
    .input(walletSchema.pick({ id: true }).and(walletSchema.partial()))
    .output(safeWalletSchema)
    .mutation(async ({ ctx, input }) => {
      const wallet = await ctx.drizzle.transaction(async (db) => {
        if (input.primary)
          await db
            .update(wallets)
            .set({
              primary: false,
            })
            .where(eq(wallets.user, ctx.user.id));
        const [wallet] = await db
          .update(wallets)
          .set(input)
          .where(and(eq(wallets.user, ctx.user.id), eq(wallets.id, input.id)))
          .returning();

        return wallet;
      });

      if (wallet) return wallet;
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "wallet not found",
      });
    }),
});
