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
  //   "4567e7264fadc3ae42faecc5e6e1b72a2d64d8be9f882f5ae3ce50c9bad29880"; // meteora
  const bundleId =
    "6fb37bb34e01e99a9545f602df5317d356788e3e78efd1552e22a5f620f0937f"; // orca
  const job = await queue.getJob(bundleId);
  console.log("job", job?.returnvalue);

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
        dex: "raydium-clmm",
        type: "closed-position",
        wallet: {
          user: wallet.user.id,
          id: wallet.id,
        },
        // positionMint: address("6KsViydbpqmnfaZd1zsn7QG3AWyiN7CcAQ6f2TPCrjko"),
      },
      {
        jobId: bundleId,
        removeOnComplete: true,
      },
    );
    console.log(response.data);
    console.log((await queue.getJob(bundleId))?.failedReason, { depth: null });
  }
})();
