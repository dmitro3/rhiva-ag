import {
  doublePrecision,
  pgTable,
  text,
  jsonb,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { positions } from "./positions";
import type { SQL } from "drizzle-orm";
import { add } from "../custom-drizzle";

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
  pnlUsd: doublePrecision().default(0).notNull(),
  baseAmount: doublePrecision().default(0).notNull(),
  baseAmountUsd: doublePrecision().default(0).notNull(),
  quoteAmount: doublePrecision().default(0).notNull(),
  quoteAmountUsd: doublePrecision().default(0).notNull(),
  claimedBaseFee: doublePrecision().default(0).notNull(),
  claimedQuoteFee: doublePrecision().default(0).notNull(),
  claimedBaseFeeUsd: doublePrecision().default(0).notNull(),
  claimedQuoteFeeUsd: doublePrecision().default(0).notNull(),
  claimedRewardsUsd: doublePrecision().default(0).notNull(),
  unclaimedBaseFee: doublePrecision().default(0).notNull(),
  unclaimedQuoteFee: doublePrecision().default(0).notNull(),
  unclaimedBaseFeeUsd: doublePrecision().default(0).notNull(),
  unclaimedQuoteFeeUsd: doublePrecision().default(0).notNull(),
  unclaimedRewardsFee: doublePrecision().array().default([]).notNull(),
  unclaimedRewardsFeeUsd: doublePrecision().array().default([]).notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  state: text({ enum: ["closed", "opened"] })
    .default("opened")
    .notNull(),
  amountUsd: doublePrecision()
    .generatedAlwaysAs((): SQL => add(pnls.baseAmountUsd, pnls.quoteAmountUsd))
    .notNull(),
  unclaimedFeeUsd: doublePrecision()
    .generatedAlwaysAs(
      (): SQL => add(pnls.unclaimedBaseFeeUsd, pnls.unclaimedQuoteFeeUsd),
    )
    .notNull(),
  claimedFeeUsd: doublePrecision()
    .generatedAlwaysAs(
      (): SQL => add(pnls.claimedBaseFee, pnls.claimedQuoteFee),
    )
    .notNull(),
});
