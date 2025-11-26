import { relations } from "drizzle-orm";

import { pnls } from "./pnls";
import { users } from "./users";
import { mints } from "./mints";
import { wallets } from "./wallets";
import { rewards } from "./rewards";
import { settings } from "./settings";
import { poolFilters } from "./filters";
import { referrers } from "./referrers";
import { positions } from "./positions";
import { messages, threads } from "./messages";
import { notifications } from "./notifications";
import { poolRewardTokens, pools } from "./pools";

export const userRelations = relations(users, ({ many, one }) => ({
  rewards: many(rewards),
  wallets: many(wallets),
  poolFilters: many(poolFilters),
  notifications: many(notifications),
  referer: many(referrers, { relationName: "referrers" }),
  settings: one(settings, { fields: [users.id], references: [settings.user] }),
}));

export const settingsRelation = relations(settings, ({ one }) => ({
  user: one(users, { fields: [settings.user], references: [users.id] }),
}));

export const poolFilterRelations = relations(poolFilters, ({ one }) => ({
  user: one(users, { fields: [poolFilters.user], references: [users.id] }),
}));

export const walletRelatios = relations(wallets, ({ one, many }) => ({
  positions: many(positions),
  user: one(users, { fields: [wallets.user], references: [users.id] }),
}));

export const refererRelations = relations(referrers, ({ one }) => ({
  user: one(users, { fields: [referrers.user], references: [users.id] }),
  referer: one(users, { fields: [referrers.referer], references: [users.id] }),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.user], references: [users.id] }),
}));

export const poolRewardTokenRelations = relations(
  poolRewardTokens,
  ({ one }) => ({
    pool: one(pools, {
      fields: [poolRewardTokens.pool],
      references: [pools.id],
    }),
    mint: one(mints, {
      fields: [poolRewardTokens.mint],
      references: [mints.id],
    }),
  }),
);

export const poolRelatins = relations(pools, ({ one, many }) => ({
  positions: many(positions),
  rewardTokens: many(poolRewardTokens),
  baseToken: one(mints, { fields: [pools.baseToken], references: [mints.id] }),
  quoteToken: one(mints, {
    fields: [pools.quoteToken],
    references: [mints.id],
  }),
}));

export const positionRelations = relations(positions, ({ one, many }) => ({
  pnls: many(pnls),
  wallet: one(wallets, {
    fields: [positions.wallet],
    references: [wallets.id],
  }),
  pool: one(pools, { fields: [positions.pool], references: [pools.id] }),
}));

export const pnlRelations = relations(pnls, ({ one }) => ({
  position: one(positions, {
    fields: [pnls.position],
    references: [positions.id],
  }),
}));

export const rewardRelations = relations(rewards, ({ one }) => ({
  user: one(users, { fields: [rewards.user], references: [users.id] }),
}));

export const threadRelations = relations(threads, ({ many, one }) => ({
  messages: many(messages),
  user: one(users, { fields: [threads.user], references: [users.id] }),
}));

export const messageRelations = relations(messages, ({ one }) => ({
  thread: one(threads, { fields: [messages.thread], references: [threads.id] }),
}));
