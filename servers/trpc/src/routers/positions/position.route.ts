import z from "zod";
import { TRPCError } from "@trpc/server";
import { and, type SQL } from "drizzle-orm";
import {
  buildDrizzleWhereClauseFromObject,
  buildOrderByClauseFromObject,
} from "@rhiva-ag/datasource";

import { orcaRoute } from "./orca/orca.route";
import { privateProcedure, router } from "../../trpc";
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
});
