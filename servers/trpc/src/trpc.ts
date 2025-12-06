import superjson from "superjson";
import { XiorError } from "xior";
import { SimulationError } from "@rhiva-ag/shared";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure.use(async ({ ctx, next, input }) => {
  const response = await next({ ctx, input });
  if (response.ok) return response;
  if (response.error.cause instanceof XiorError)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: response.error.cause.response?.data,
    });
  if (response.error.cause instanceof SimulationError)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: response.error.cause?.logs.join("\n"),
    });
  return response;
});
export const privateProcedure = publicProcedure.use(({ ctx, next, input }) => {
  if (ctx.user) return next({ ctx: { ...ctx, user: ctx.user }, input });

  throw new TRPCError({ code: "UNAUTHORIZED" });
});
