import { TRPCError } from "@trpc/server";
import { walletInsertSchema } from "@rhiva-ag/datasource";

import { router, privateProcedure } from "../../trpc";
import { createWallet } from "../../controllers/wallet.controller";

export const walletRoute = router({
  create: privateProcedure
    .input(walletInsertSchema.pick({ id: true, primary: true }))
    .mutation(async ({ ctx, input }) => {
      const wallet = await createWallet(ctx.drizzle, ctx.secret, {
        ...input,
        user: ctx.user.id,
      });
      if (wallet) return wallet;

      throw new TRPCError({
        code: "UNPROCESSABLE_CONTENT",
        message: "wallet not created",
      });
    }),
});
