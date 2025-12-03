import type { z } from "zod";
import type {
  walletSchema,
  userSelectSchema,
  poolSelectSchema,
  positionSelectSchema,
  settingsSelectSchema,
} from "@rhiva-ag/datasource";

export type Position = Pick<
  z.infer<typeof positionSelectSchema>,
  "id" | "config"
> & {
  wallet: Omit<z.infer<typeof walletSchema>, "user"> & {
    user: Pick<z.infer<typeof userSelectSchema>, "id"> & {
      settings: Pick<
        z.infer<typeof settingsSelectSchema>,
        "slippage" | "rebalanceType"
      >;
    };
  };
  pool: Pick<z.infer<typeof poolSelectSchema>, "id">;
};
