import z from "zod";
import { TRPCError } from "@trpc/server";
import { and, type SQL } from "drizzle-orm";
import { observable } from "@trpc/server/observable";
import { Work, transactionEventSchema } from "@rhiva-ag/cron";
import {
  buildDrizzleWhereClauseFromObject,
  buildOrderByClauseFromObject,
} from "@rhiva-ag/datasource";

import { orcaRoute } from "./orca/orca.route";
import { createRedis } from "../../instances";
import { privateProcedure, publicProcedure, router } from "../../trpc";
import { meteoraRoute } from "./meteora/meteora.route";
import { raydiumRoute } from "./raydium/raydium.route";
import { positionFilterSchema, positionSortSchema } from "./position.schema";
import {
  getWalletPositions,
  getWalletPositionsAggregrate,
} from "./position.controller";

export const positionRoute = router({
  orca: orcaRoute,
  raydium: raydiumRoute,
  meteora: meteoraRoute,
  aggregrate: privateProcedure.query(async ({ ctx }) => {
    const [aggregrate] = await getWalletPositionsAggregrate(
      ctx.drizzle,
      ctx.user.wallet.id,
    );

    if (aggregrate) return aggregrate;

    throw new TRPCError({
      code: "NOT_FOUND",
      message: "no position aggregrate found",
    });
  }),
  list: privateProcedure
    .input(
      z
        .object({
          limit: z.number().optional(),
          offset: z.number().optional(),
          sortBy: positionSortSchema.optional(),
          filter: positionFilterSchema.partial().optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) => {
      let where: SQL<unknown> | undefined;
      let orderBy: SQL<unknown>[] | undefined;

      if (input?.sortBy) orderBy = buildOrderByClauseFromObject(input.sortBy);
      if (input?.filter)
        where = and(...buildDrizzleWhereClauseFromObject(input.filter));

      return getWalletPositions(ctx.drizzle, ctx.user.wallet.id, {
        where,
        orderBy,
        limit: input?.limit,
        offset: input?.offset,
      });
    }),
  transaction: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .subscription(async ({ input }) => {
      const redis = createRedis({ maxRetriesPerRequest: null });
      return observable<z.infer<typeof transactionEventSchema>>((emit) => {
        const handler = (_channel: Work, message: string) => {
          const result = transactionEventSchema.safeParse(JSON.parse(message));
          if (result.success) {
            const data = result.data;
            if (data.jobId === input.jobId) emit.next(data);
          }
        };

        redis.subscribe(Work.syncTransaction);
        redis.on("message", handler);

        return () => {
          redis.off("message", handler);
          redis.disconnect();
        };
      });
    }),
});
