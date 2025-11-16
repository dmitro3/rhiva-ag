import superjson from "superjson";
import { XiorError } from "xior";
import { SimulationError } from "@rhiva-ag/shared";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter(opts) {
    const { shape, error } = opts;
    if (error.cause instanceof XiorError) {
      return {
        ...shape,
        message: error.cause.response?.data,
        data: {
          ...shape.data,
          code: "INTERNAL_SERVER_ERROR",
        },
      };
    }
    if (error.cause instanceof SimulationError)
      return {
        ...shape,
        message: error.cause.logs,
        data: {
          ...shape.data,
          code: "BAD_REQUEST",
        },
      };

    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const privateProcedure = t.procedure.use(({ ctx, next, input }) => {
  if (ctx.user) return next({ ctx: { ...ctx, user: ctx.user }, input });

  throw new TRPCError({ code: "UNAUTHORIZED" });
});
