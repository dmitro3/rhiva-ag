import {
  doublePrecision,
  pgTable,
  text,
  jsonb,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { positions } from "./positions";

type Extra = {
  rewards?: number[];
  rewardUsd?: number[];
};

export const pnls = pgTable("pnls", {
  id: uuid().defaultRandom().primaryKey(),
  position: text()
    .references(() => positions.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  config: jsonb().$type<{ extra?: Extra }>(),
  feeUsd: doublePrecision().notNull(),
  pnlUsd: doublePrecision().notNull(),
  rewardUsd: doublePrecision().notNull(),
  amountUsd: doublePrecision().notNull(),
  baseAmount: doublePrecision().default(0).notNull(),
  baseAmountUsd: doublePrecision().default(0).notNull(),
  quoteAmount: doublePrecision().default(0).notNull(),
  quoteAmountUsd: doublePrecision().default(0).notNull(),
  claimedFeeUsd: doublePrecision().default(0).notNull(),
  unclaimedBaseFee: doublePrecision().default(0).notNull(),
  unclaimedQuoteFee: doublePrecision().default(0).notNull(),
  unclaimedBaseFeeUsd: doublePrecision().default(0).notNull(),
  unclaimedQuoteFeeUsd: doublePrecision().default(0).notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  state: text({ enum: ["closed", "opened"] })
    .default("opened")
    .notNull(),
});
