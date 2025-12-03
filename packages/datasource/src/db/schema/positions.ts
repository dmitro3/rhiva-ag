import {
  doublePrecision,
  jsonb,
  pgTable,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

import { pools } from "./pools";
import { wallets } from "./wallets";

type Extra = {
  claimedBaseFee: number;
  claimedQuoteFee: number;
  claimedReward0Fee?: number;
  claimedReward1Fee?: number;
  claimedFeeUsd: number;
};

export type HistoricalData = {
  openPrice?: {
    baseToken?: number;
    quoteToken?: number;
  };
  closingPrice?: {
    baseToken?: number;
    quoteToken?: number;
  };
};

export const positions = pgTable("positions", {
  id: text().primaryKey().notNull(),
  amountUsd: doublePrecision().notNull(),
  config: jsonb()
    .$type<{
      extra?: Extra;
      history?: HistoricalData;
      priceRange?: [number, number];
      repositionTime: number;
      enableAutoClaim: boolean;
      lastRepositionTime?: Date;
      enableAutoCompound: boolean;
    }>()
    .notNull(),
  wallet: text()
    .references(() => wallets.id, { onDelete: "cascade" })
    .notNull(),
  pool: text()
    .references(() => pools.id, { onDelete: "restrict" })
    .notNull(),
  active: boolean().notNull(),
  status: text({ enum: ["pending", "error", "successful"] }).notNull(),
  state: text({
    enum: ["idle", "open", "rebalanced", "repositioned", "closed"],
  }).notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
