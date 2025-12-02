import { type SQL, sql, type Column, getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

// Todo: support nested jsonb types
export const updateJSON = <T extends Column, U extends T["_"]["data"]>(
  column: T,
  value: Partial<U>,
) => sql`${column} || ${JSON.stringify(value)}::jsonb`;

export const unnest = <T extends Column | SQL<unknown> | SQL.Aliased>(
  column: T,
) => sql`UNNEST(${column})`;

export const add = <T extends Array<Column | SQL<unknown> | SQL.Aliased>>(
  ...[a, b]: T
) => sql`COALESCE(${a}::decimal) + COALESCE(${b}::decimal, 0)`;

export const int = <T extends Column | SQL<unknown> | SQL.Aliased>(column: T) =>
  sql`${column}::int`;
export const decimal = <T extends Column | SQL<unknown> | SQL.Aliased>(
  column: T,
) => sql`${column}::decimal`;

export const caseWhen = <T extends SQL<unknown>, U>(when: T, then: U) =>
  sql`CASE WHEN ${when} THEN ${then} END`;

export const coalesce = <T extends Column | SQL.Aliased | SQL<unknown>>(
  column: T,
  value: number | string,
) => sql`COALESCE(${column}, ${value})`;

export const day = <T extends Column>(column: T) => sql`DATE(${column})`;

export const date = <T extends Column | SQL<unknown>>(column: T) =>
  sql`DATE(${column})`;

export const rank = <T extends Column | SQL<unknown> | SQL.Aliased>(
  column: T,
) => sql`RANK() OVER (ORDER BY ${column} DESC)`;

export const count = () => sql<number>`COUNT(*) OVER ()`;

export const mul = <T extends Column | SQL<unknown> | SQL.Aliased>(
  column: T,
  multiplier: number,
) => sql`${column}::decimal * ${multiplier}::decimal`;

export const buildConflictUpdateColumns = <
  T extends PgTable,
  Q extends keyof T["_"]["columns"],
>(
  table: T,
  columns: Q[],
) => {
  const cls = getTableColumns(table);

  return columns.reduce(
    (acc, column) => {
      const columnName = cls[column]?.name;
      if (columnName) acc[column] = sql.raw(`excluded."${columnName}"`);

      return acc;
    },
    {} as Record<Q, SQL>,
  );
};
