import type z from "zod";
import { eq, type SQL } from "drizzle-orm";
import {
  type Database,
  pools,
  type poolSelectSchema,
  positions,
} from "@rhiva-ag/datasource";

export const getPositionsWhere = async (
  db: Database,
  where?: SQL,
  _dex?: z.infer<typeof poolSelectSchema>["dex"],
) => {
  return db.query.positions.findMany({
    columns: {
      id: true,
      pool: false,
      config: true,
      amountUsd: true,
    },
    with: {
      pool: {
        columns: {
          baseToken: false,
          quoteToken: false,
          rewardTokens: false,
        },
        with: {
          baseToken: true,
          quoteToken: true,
          rewardTokens: {
            columns: {
              mint: false,
            },
            with: {
              mint: {
                columns: {
                  id: true,
                  decimals: true,
                  extensions: true,
                },
              },
            },
          },
        },
      },
    },
    where,
  });
};

export const getPoolById = async (
  db: Database,
  id: (typeof pools.$inferSelect)["id"],
) =>
  await db.query.pools.findFirst({
    columns: {
      baseToken: false,
      quoteToken: false,
    },
    with: {
      baseToken: {
        columns: {
          id: true,
          symbol: true,
          decimals: true,
        },
      },
      quoteToken: {
        columns: {
          id: true,
          symbol: true,
          decimals: true,
        },
      },
    },
    where: eq(pools.id, id),
  });

export const getPositionById = async (
  db: Database,
  id: (typeof pools.$inferSelect)["id"],
) =>
  await db.query.positions
    .findFirst({
      columns: {
        pool: false,
      },
      with: {
        pool: {
          columns: {
            baseToken: false,
            quoteToken: false,
          },
          with: {
            baseToken: {
              columns: {
                id: true,
                symbol: true,
                decimals: true,
              },
            },
            quoteToken: {
              columns: {
                id: true,
                symbol: true,
                decimals: true,
              },
            },
          },
        },
      },
      where: eq(positions.id, id),
    })
    .execute();
