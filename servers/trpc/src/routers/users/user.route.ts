import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { users, userUpdateSchema } from "@rhiva-ag/datasource";

import { getUserById } from "./user.controller";
import { privateProcedure, router } from "../../trpc";
import { extendedUserSelectSchema } from "./user.schema";

export const userRoute = router({
  me: privateProcedure
    .output(extendedUserSelectSchema)
    .query(async ({ ctx }) => {
      const user = await getUserById(ctx.drizzle, ctx.user.id);
      if (user) return user;

      throw new TRPCError({ code: "NOT_FOUND", message: "user not found" });
    }),
  update: privateProcedure
    .input(
      userUpdateSchema
        .omit({
          id: true,
          uid: true,
          email: true,
          lastLogin: true,
          referralCode: true,
          currentStreak: true,
        })
        .partial(),
    )
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.drizzle
        .update(users)
        .set(input)
        .where(eq(users.id, ctx.user.id))
        .returning();
      if (user) return user;

      throw new TRPCError({ code: "NOT_FOUND", message: "user not found" });
    }),
});
