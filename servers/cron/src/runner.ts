import { logger } from "./instances";

export const runWorker = async (fn: Promise<() => Promise<void>>) => {
  const stopFn = await fn;

  const shutdown = async () => {
    await stopFn();
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
};
