import createPositionWorker from "./position.worker";
import createTransactionWorker from "./transaction.worker";
import { db, logger, sender, coingecko, solanaConnection } from "../instances";

(async () => {
  const stopFns = await Promise.all([
    createPositionWorker({
      db,
      logger,
      coingecko,
      connection: solanaConnection,
    }),
    createTransactionWorker({
      db,
      logger,
      sender,
      coingecko,
      connection: solanaConnection,
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
