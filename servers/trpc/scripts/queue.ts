import { Work } from "@rhiva-ag/cron";
import { createQueue } from "../src/routers/positions/shared";

await (async () => {
  const queue = createQueue();
  await queue.add(
    Work.syncTransaction,
    {
      bundleId:
        "1d413032a13fa2e6e4d767019c741ef54ddf6b4a5543db3f77aa7d25a44635f9",
      dex: "meteora",
      type: "create-position",
      wallet: {
        id: "DUhm8aTpGsaYzbo2JQ5hhrNf9KANxuQcqNXJSCQsWpfX",

        user: "1aae5586-8fa7-4957-b265-d1c0f12d473a",
      },
    },
    {
      jobId: "1d413032a13fa2e6e4d767019c741ef54ddf6b4a5543db3f77aa7d25a44635f9",
    },
  );
})();
