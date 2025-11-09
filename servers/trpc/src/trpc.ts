import superjson from "superjson";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const privateProcedure = t.procedure.use(({ ctx, next, input }) => {
  if (ctx.user) return next({ ctx: { ...ctx, user: ctx.user }, input });

  throw new TRPCError({ code: "UNAUTHORIZED" });
});
