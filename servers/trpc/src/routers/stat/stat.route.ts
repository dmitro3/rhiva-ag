import z from "zod";
import { TRPCError } from "@trpc/server";

import { honkIndexSchema } from "./stat.schema";
import { publicProcedure, router } from "../../trpc";

export const statRoute = router({
  fearGreed: publicProcedure.output(z.number()).query(async ({ ctx }) => {
    const fearGreed = await ctx.redis.get("fear_greed");

    if (fearGreed) return parseFloat(fearGreed);

    throw new TRPCError({
      code: "NOT_FOUND",
      message: "fear greed not found.",
    });
  }),
  honkIndex: publicProcedure.output(honkIndexSchema).query(async ({ ctx }) => {
    const honkIndex = await ctx.redis.get("hook_index");

    if (honkIndex) return JSON.parse(honkIndex);

    throw new TRPCError({
      code: "NOT_FOUND",
      message: "honk index not found.",
    });
  }),
});
