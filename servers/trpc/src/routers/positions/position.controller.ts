import type z from "zod";
import moment from "moment";
import {
  and,
  avg,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  lt,
  not,
  sum,
  type SQL,
} from "drizzle-orm";
import {
  pnls,
  positions,
  caseWhen,
  int,
  coalesce,
  decimal,
  add,
  type Database,
  type walletSelectSchema,
} from "@rhiva-ag/datasource";

export const getWalletPositions = async (
  db: Database,
  wallet: z.infer<typeof walletSelectSchema>["id"],
  extra?: {
    limit?: number;
    offset?: number;
    where?: SQL<unknown>;
    orderBy?: SQL<unknown>[];
  },
) => {
  const totalQuery = db
    .select({
      count: count(positions.id),
    })
    .from(positions)
    .where(and(eq(positions.wallet, wallet), extra?.where));
  if (extra?.orderBy) totalQuery.orderBy(...extra.orderBy);
  const [total] = await totalQuery.execute();

  const items = await db.query.positions
    .findMany({
      with: {
        pnls: {
          limit: 1,
          orderBy: desc(pnls.createdAt),
        },
        pool: {
          columns: {
            id: true,
            dex: true,
            config: true,
          },
          with: {
            baseToken: true,
            quoteToken: true,
            rewardTokens: {
              with: {
                mint: true,
              },
            },
          },
        },
      },
      columns: {
        pool: false,
      },
      ...extra,
      where: and(eq(positions.wallet, wallet), extra?.where),
    })
    .execute();

  return {
    items,
    total: total?.count,
  };
};

export const getWalletPositionsAggregrate = (
  db: Database,
  wallet: z.infer<typeof walletSelectSchema>["id"],
) => {
  const qPnl = db
    .selectDistinctOn([pnls.position], getTableColumns(pnls))
    .from(pnls)
    .orderBy(pnls.position, desc(pnls.createdAt))
    .as("qPnl");
  const month = moment().startOf("month").toDate();

  return db
    .select({
      feeUsd: coalesce(sum(qPnl.feeUsd), 0).mapWith(Number),
      avgInvestedUsd: coalesce(avg(positions.amountUsd), 0).mapWith(Number),
      networthUsd: coalesce(
        add(
          sum(decimal(caseWhen(eq(positions.state, "open"), qPnl.amountUsd))),
          coalesce(
            sum(
              caseWhen(
                and(gt(qPnl.pnlUsd, 0), eq(positions.state, "open"))!,
                qPnl.pnlUsd,
              ),
            ),
            0,
          ),
        ),
        0,
      ).mapWith(Number),
      lossUsd: coalesce(
        sum(decimal(caseWhen(lt(qPnl.pnlUsd, 0), qPnl.pnlUsd))),
        0,
      ).mapWith(Number),
      profitUsd: coalesce(
        sum(decimal(caseWhen(gt(qPnl.pnlUsd, 0), qPnl.pnlUsd))),
        0,
      ).mapWith(Number),
      avgMonthlyProfit: coalesce(
        sum(decimal(caseWhen(gt(positions.createdAt, month), qPnl.pnlUsd))),
        0,
      ).mapWith(Number),
      closed: coalesce(
        sum(int(caseWhen(eq(positions.state, "closed"), 1))),
        0,
      ).mapWith(Number),
      opened: coalesce(
        sum(int(caseWhen(not(eq(positions.state, "closed")), 1))),
        0,
      ).mapWith(Number),
    })
    .from(positions)
    .leftJoin(qPnl, eq(qPnl.position, positions.id))
    .where(eq(positions.wallet, wallet))
    .execute();
};
