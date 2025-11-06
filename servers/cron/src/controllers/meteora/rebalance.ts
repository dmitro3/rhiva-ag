import type z from "zod";
import type Dex from "@rhiva-ag/dex";
import type { KMSSecret, SendTransaction } from "@rhiva-ag/shared";
import type {
  positionSelectSchema,
  settingsSelectSchema,
  walletSchema,
} from "@rhiva-ag/datasource";

export const rabalanceMeteoraPosition = async (_args: {
  dex: Dex;
  secret: KMSSecret;
  sender: SendTransaction;
  position: z.infer<typeof positionSelectSchema>;
  settings: z.infer<typeof settingsSelectSchema>;
  wallet: Pick<z.infer<typeof walletSchema>, "id" | "key" | "wrappedDek">;
}) => {};
