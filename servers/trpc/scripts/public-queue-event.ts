import { Work } from "@rhiva-ag/cron";
import { createDB, wallets } from "@rhiva-ag/datasource";

import { sendTransaction } from "../src/instances";
import { createQueue } from "../src/routers/positions/shared";
import { getEnv } from "../src/env";
import { eq } from "drizzle-orm";

const queue = createQueue();
const db = createDB(getEnv("DATABASE_URL"));

(async () => {
  const bundleId =
    "26177f51e4def67b0aaddde6369e7711e3bb74d7038ba491a92d1d53ac10ac09";
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
        dex: "meteora",
        type: "create-position",
        wallet: {
          user: wallet.user.id,
          id: wallet.id,
        },
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
