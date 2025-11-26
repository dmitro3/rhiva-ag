import {
  boolean,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const wallets = pgTable(
  "wallets",
  {
    id: text().primaryKey(),
    key: text(),
    wrappedDek: text(),
    external: boolean().notNull(),
    primary: boolean().default(false).notNull(),
    user: uuid()
      .references(() => users.id, { onDelete: "cascade" })
      .unique()
      .notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (column) => [unique().on(column.user, column.primary)],
);
