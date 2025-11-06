import { format } from "util";
import superjson from "superjson";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure.use(
  t.middleware(async ({ path, input, ctx, next }) => {
    if (process.env.NODE_ENV === "production") return next();
    const cacheKey = format("trpc:%s:%s", path, JSON.stringify(input));
    const cacheData = await ctx.redis.get(cacheKey);
    if (cacheData)
      return { ok: true, data: JSON.parse(cacheData) } as Awaited<
        ReturnType<typeof next>
      >;

    const result = await next();
    if (result.ok) await ctx.redis.set(cacheKey, JSON.stringify(result.data));
    return result;
  }),
);
export const privateProcedure = t.procedure.use(({ ctx, next, input }) => {
  if (ctx.user) return next({ ctx: { ...ctx, user: ctx.user }, input });

  throw new TRPCError({ code: "UNAUTHORIZED" });
});
