import z from "zod";
import { createUpdateSchema } from "drizzle-zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import {
  mints,
  notifications,
  pnls,
  poolFilters,
  pools,
  positions,
  referrers,
  rewards,
  settings,
  threads,
  users,
  wallets,
  messages,
} from "./schema";

export * from "./zod-custom";

export const walletSchema = createSelectSchema(wallets).extend({
  external: z.boolean(),
});
export const walletSelectSchema = walletSchema
  .extend({ external: z.literal(false) })
  .or(
    walletSchema
      .omit({ wrappedDek: true, key: true })
      .extend({ external: z.literal(true) }),
  );

export const settingsInsertSchema = createInsertSchema(settings);
export const settingsUpdateSchema = createUpdateSchema(settings);
export const settingsSelectSchema = createSelectSchema(settings);

export const userInsertSchema = createInsertSchema(users);
export const userUpdateSchema = createUpdateSchema(users);
export const userSelectSchema = createSelectSchema(users).extend({
  xp: z.number(),
  rank: z.number(),
  referXp: z.number(),
  totalUsers: z.number(),
  todayXp: z.number(),
  totalRefer: z.number(),
  settings: settingsSelectSchema.omit({ user: true }),
  wallet: walletSchema.omit({ user: true, key: true, wrappedDek: true }),
});

export const poolFilterInsertSchema = createInsertSchema(poolFilters);
export const poolFilterSelectSchema = createSelectSchema(poolFilters);

export const refererInsertSchema = createInsertSchema(referrers);
export const refererSelectSchema = createSelectSchema(referrers, {
  user: userInsertSchema,
  referer: userSelectSchema,
});

export const notificationInsertSchema = createInsertSchema(notifications);
export const notificationSelectSchema = createSelectSchema(notifications);

export const mintInsertSchema = createInsertSchema(mints);
export const mintSelectSchema = createSelectSchema(mints);

export const poolInsertSchema = createInsertSchema(pools);
export const poolSelectSchema = createSelectSchema(pools, {
  baseToken: mintSelectSchema,
  quoteToken: mintSelectSchema,
});

export const positionInsertSchema = createInsertSchema(positions);
export const positionSelectSchema = createSelectSchema(positions, {
  pool: poolSelectSchema,
});

export const pnlSelectSchema = createSelectSchema(pnls);
export const pnlInsertSchema = createInsertSchema(pnls, {
  position: positionSelectSchema,
});

export const rewardInsertSchema = createInsertSchema(rewards);
export const rewardSelectSchema = createSelectSchema(rewards);

export const threadInsertSchema = createInsertSchema(threads);
export const threadSelectSchema = createSelectSchema(threads);

export const messageInsertSchema = createInsertSchema(messages);
export const messageSelectSchema = createSelectSchema(messages);
