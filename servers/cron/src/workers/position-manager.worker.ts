import type z from "zod";
import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import type { Logger } from "pino";
import Dex from "@rhiva-ag/dex";
import { settings, type Database } from "@rhiva-ag/datasource";
import type { KMSSecret, Secret, SendTransaction } from "@rhiva-ag/shared";

import { CONCURRENT_WORK, Work } from "../constants";
import { runWorker } from "../runner";
import { positionManagerWorkSchema } from "./schema";
import { repositionOrcaPositions } from "../controllers/orca";
import { rebalanceMeteoraPositions } from "../controllers/meteora";
import { repositionRaydiumPositions } from "../controllers/raydium";
import {
  db,
  logger,
  sender,
  secret,
  createRedis,
  solanaConnection,
} from "../instances";

const fn = async ({
  db,
  dex,
  logger,
  secret,
  sender,
}: {
  dex: Dex;
  db: Database;
  logger: Logger;
  sender: SendTransaction;
  secret: KMSSecret | Secret;
}) => {
  const worker = new Worker(
    Work.syncPosition,
    async ({ data }: Job<z.infer<typeof positionManagerWorkSchema>>) => {
      logger.info({ data }, "position.manager.worker");
      const result = positionManagerWorkSchema.safeParse(data);

      if (result.success) {
        const userSettings = await db.query.settings
          .findFirst({
            where: eq(settings.user, result.data?.user),
          })
          .execute();

        if (!userSettings) return;
        const allPositions = await db.query.positions
          .findMany({
            columns: {
              id: true,
              pool: false,
              wallet: false,
            },
            with: {
              pool: {
                columns: {
                  id: true,
                },
              },
              wallet: {
                columns: {
                  user: false,
                },
                with: {
                  user: {
                    columns: {
                      id: true,
                    },
                    with: {
                      settings: true,
                    },
                  },
                },
              },
            },
          })
          .execute();

        switch (data.dex) {
          case "orca": {
            return repositionOrcaPositions(
              {
                dex,
                secret,
                sender,
              },
              ...allPositions,
            );
          }
          case "meteora":
            return rebalanceMeteoraPositions(
              {
                dex,
                secret,
                sender,
              },
              ...allPositions,
            );
          case "raydium-clmm":
            return repositionRaydiumPositions(
              {
                dex,
                secret,
                sender,
              },
              ...allPositions,
            );
          default:
            return;
        }
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

  if (!worker.isRunning()) await worker.run();

  return async () => {
    await worker.close();
    await worker.disconnect();
  };
};

export default runWorker(
  fn({
    db,
    sender,
    secret,
    logger,
    dex: new Dex(solanaConnection),
  }),
);
