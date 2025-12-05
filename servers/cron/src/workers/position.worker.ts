import type z from "zod";
import type { Logger } from "pino";
import { type Job, Worker } from "bullmq";
import { createSolanaRpc } from "@solana/kit";
import type { Connection } from "@solana/web3.js";
import type { Database } from "@rhiva-ag/datasource";
import type Coingecko from "@coingecko/coingecko-typescript";

import { runWorker } from "../runner";
import { positionWorkSchema } from "./schema";
import { CONCURRENT_WORK, Work } from "../constants";
import { syncOrcaPositionsForWallet } from "../controllers/orca";
import { syncRaydiumPositionsForWallet } from "../controllers/raydium";
import { syncMeteoraPositionsForWallet } from "../controllers/meteora";
import {
  db,
  logger,
  coingecko,
  createRedis,
  solanaConnection,
} from "../instances";

const fn = async ({
  db,
  logger,
  coingecko,
  connection,
}: {
  db: Database;
  logger: Logger;
  coingecko: Coingecko;
  connection: Connection;
}) => {
  const worker = new Worker(
    Work.syncPosition,
    async ({ data }: Job<z.infer<typeof positionWorkSchema>>) => {
      logger.info({ data }, "position.sync.worker");
      const result = positionWorkSchema.safeParse(data);

      if (result.success)
        switch (data.dex) {
          case "orca": {
            const rpc = createSolanaRpc(connection.rpcEndpoint);
            return syncOrcaPositionsForWallet({
              rpc,
              db,
              coingecko,
              wallet: data.wallet,
            });
          }
          case "meteora":
            return syncMeteoraPositionsForWallet({
              db,
              coingecko,
              connection,
              wallet: data.wallet,
            });
          case "raydium-clmm":
            return syncRaydiumPositionsForWallet({
              db,
              coingecko,
              connection,
              wallet: data.wallet,
            });
          default:
            return;
        }

      logger.error(
        { data, error: result.error.format() },
        "worker.position.sync.error",
      );
    },
    {
      concurrency: CONCURRENT_WORK,
      connection: createRedis({ maxRetriesPerRequest: null }),
    },
  );

  worker.on("completed", (job) => {
    logger.info(
      { id: job.id, data: job.data },
      "worker.position.sync.successful",
    );
  });

  worker.on("failed", async (job, error) => {
    logger.error(
      {
        error,
        job: {
          id: job?.id,
          data: job?.data,
          stacktrace: job?.stacktrace,
          failedReason: job?.failedReason,
        },
      },
      "worker.position.sync.failed",
    );
  });
  worker.on("error", (error) => {
    logger.error({ error }, "worker.position.sync.error");
  });

  if (!worker.isRunning()) await worker.run();

  return async () => {
    await worker.close();
    await worker.disconnect();
  };
};

export default runWorker(
  fn({
    db,
    logger,
    coingecko,
    connection: solanaConnection,
  }),
);
