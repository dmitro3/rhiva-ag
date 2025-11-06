import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

export const wallets = pgTable("wallets", {
  id: text().primaryKey(),
  key: text(),
  wrappedDek: text(),
  external: boolean().notNull(),
  user: uuid()
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
