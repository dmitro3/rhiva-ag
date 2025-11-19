import { Work } from "@rhiva-ag/cron";
import { createDB, wallets } from "@rhiva-ag/datasource";

import { createQueue } from "../src/routers/positions/shared";
import { getEnv } from "../src/env";
import { eq } from "drizzle-orm";
import { address } from "@solana/kit";

const queue = createQueue();
const db = createDB(getEnv("DATABASE_URL"));

(async () => {
  // const bundleId =
  //   "26177f51e4def67b0aaddde6369e7711e3bb74d7038ba491a92d1d53ac10ac09"; // meteora
  const bundleId =
    "fb25bb97835019d039f2450a7649c5b5865d30cccce2750701014a7d5115bc88";
  const job = await queue.getJob(bundleId);
  console.log("job", job);

  if (job?.isFailed) await queue.remove(bundleId);

  const wallet = await db.query.wallets.findFirst({
    with: {
      user: true,
    },
    where: eq(wallets.id, "GQFJibdqFGdNXm5PKvm4MmEDgNXHP1JcXNonedi2Z7kT"),
  });

  if (wallet) {
    const response = await queue.add(
      Work.syncTransaction,
      {
        bundleId,
        dex: "orca",
        type: "create-position",
        wallet: {
          user: wallet.user.id,
          id: wallet.id,
        },
        positionMint: address("AchUZ3FXRdeMBSouoqTj8bgL2C7UMNdYvBSNNUYwS8ww"),
      },
      {
        jobId: bundleId,
        removeOnComplete: true,
      },
    );
    console.log(response.data);
    console.log(
      (
        await queue.getJob(
          "26177f51e4def67b0aaddde6369e7711e3bb74d7038ba491a92d1d53ac10ac09",
        )
      )?.failedReason,
      { depth: null },
    );
  }
})();
