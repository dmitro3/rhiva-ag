import { and, eq, gte, lte, sum } from "drizzle-orm";
import { coalesce, date, pnls } from "@rhiva-ag/datasource";

import { pnlFilterSchema } from "./pnl.schema";
import { orcaRoute } from "./orca/orca.router";
import { privateProcedure, router } from "../../trpc";
import { meteoraRoute } from "./meteora/meteora.router";
import { raydiumRoute } from "./raydium/raydium.router";

export const pnlRoute = router({
  history: privateProcedure.input(pnlFilterSchema).query(({ ctx, input }) => {
    const dateColumn = date(pnls.updatedAt);
    return ctx.drizzle
      .select({
        date: dateColumn,
        pnlUsd: coalesce(sum(pnls.pnlUsd), 0).mapWith(Number),
      })
      .from(pnls)
      .groupBy(dateColumn)
      .orderBy(dateColumn)
      .where(
        and(
          eq(pnls.state, "closed"),
          gte(pnls.createdAt, input.start),
          lte(pnls.createdAt, input.end),
        ),
      )
      .execute();
  }),
  orca: orcaRoute,
  meteora: meteoraRoute,
  raydium: raydiumRoute,
});
