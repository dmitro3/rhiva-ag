import { Work } from "@rhiva-ag/cron";
import { createRedis } from "../src/instances";

(() => {
  const jobId =
    "bf38a4710be229ac8775c379487f99c0295fcdcee2d29383110007f1fb078fd2";
  const events = ["queued", "pending", "completed"];
  const type = "create-position";
  let currentEventIndex = 0;
  const redis = createRedis();

  setInterval(() => {
    const status = events[currentEventIndex];
    redis.publish(
      Work.syncTransaction,
      JSON.stringify({
        jobId,
        type,
        status,
      }),
    );

    currentEventIndex += 1;
  }, 5_000);
})();
