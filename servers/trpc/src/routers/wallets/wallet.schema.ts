import { walletSchema } from "@rhiva-ag/datasource";

export const safeWalletSchema = walletSchema.pick({
  id: true,
  primary: true,
  external: true,
  createdAt: true,
});
