import z from "zod";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { getChannelId, transactionEventSchema } from "@rhiva-ag/cron";

import { createRedis } from "../../instances";
import { publicProcedure, router } from "../../trpc";

export const jobRoute = router({
  subscribe: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .subscription(async ({ input }) => {
      const channelId = getChannelId(input.jobId);
      const redis = createRedis({ maxRetriesPerRequest: null });
      return observable<z.infer<typeof transactionEventSchema>>((emit) => {
        const handler = (_channel: string, message: string) => {
          const result = transactionEventSchema.safeParse(JSON.parse(message));
          if (result.success) {
            const data = result.data;
            if (data.jobId === input.jobId) emit.next(data);
          }
        };

        redis.subscribe(channelId);
        redis.on("message", handler);

        return () => {
          redis.off("message", handler);
          redis.disconnect();
        };
      });
    }),
  retrieve: publicProcedure
    .input(
      z.object({
        jobId: z.string(),
      }),
    )
    .output(transactionEventSchema)
    .query(async ({ input, ctx }) => {
      const channelId = getChannelId(input.jobId);
      const event = await ctx.redis.get(channelId);
      if (event) {
        const result = transactionEventSchema.safeParse(JSON.parse(event));
        if (result.success) return result.data;
        else
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error.message,
          });
      }
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "job not found",
      });
    }),
});
