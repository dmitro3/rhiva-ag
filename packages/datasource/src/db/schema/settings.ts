import {
  boolean,
  doublePrecision,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

type Extra = {
  claim: {
    swapToNative: boolean;
  };
  close: {
    swapToNative: boolean;
  };
};

export const settings = pgTable("settings", {
  user: uuid()
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .primaryKey()
    .notNull(),
  extra: jsonb()
    .$type<Extra>()
    .default({
      claim: {
        swapToNative: true,
      },
      close: {
        swapToNative: true,
      },
    })
    .notNull(),
  slippage: doublePrecision().default(10).notNull(),
  autoclaimTime: doublePrecision().default(3_600_000).notNull(),
  autocompoundTime: doublePrecision().default(3_600_000).notNull(),
  rebalanceTime: doublePrecision().default(60_000).notNull(),
  gasPriorityFee: doublePrecision().default(0.0001).notNull(),
  enableAutoClaim: boolean().default(false).notNull(),
  enableAutoCompound: boolean().default(false).notNull(),
  enableNotifications: boolean().default(true).notNull(),
  rebalanceType: text({ enum: ["swap", "swapless"] })
    .default("swapless")
    .notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
