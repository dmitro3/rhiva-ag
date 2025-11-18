import { db, logger } from "../instances";
import createRetrySchedule from "./retry.schedule";
import createPositionSyncScheduleWorker from "./position.schedule";

(async () => {
  const stopFns = await Promise.all([
    createRetrySchedule({ logger }),
    createPositionSyncScheduleWorker({
      db,
      logger,
    }),
  ]);

  const shutdown = async () => {
    await Promise.all(stopFns.map((fn) => fn()));
    process.exit();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("uncaughtException", (error) =>
    logger.error({ error }, "Uncaught Exception"),
  );
  process.on("unhandledRejection", (reason) =>
    logger.error({ reason }, "Unhandled Promise Rejection"),
  );
})();
