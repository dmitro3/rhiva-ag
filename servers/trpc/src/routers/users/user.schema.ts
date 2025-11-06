import {
  settingsSelectSchema,
  userSelectSchema,
  walletSchema,
} from "@rhiva-ag/datasource";

export const extendedUserSelectSchema = userSelectSchema
  .omit({ lastLogin: true })
  .extend({
    settings: settingsSelectSchema
      .omit({ user: true })
      .omit({ updatedAt: true }),
    wallet: walletSchema.omit({
      key: true,
      user: true,
      wrappedDek: true,
      createdAt: true,
    }),
  });
