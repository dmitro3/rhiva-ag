import type z from "zod";
import Dex from "@rhiva-ag/dex";
import type { Logger } from "pino";
import { Worker, type Job } from "bullmq";
import { and, eq, inArray, not } from "drizzle-orm";
import { positions, type Database } from "@rhiva-ag/datasource";
import type { KMSSecret, Secret, SendTransaction } from "@rhiva-ag/shared";

import { runWorker } from "../runner";
import type { Position } from "../controllers/types";
import { CONCURRENT_WORK, Work } from "../constants";
import { positionManagerWorkSchema } from "../schemas";
import { repositionOrcaPositions } from "../controllers/orca";
import { rebalanceMeteoraPositions } from "../controllers/meteora";
import { repositionRaydiumPositions } from "../controllers/raydium";
import { autoclaimOrcaPositions } from "../controllers/orca/autoclaim";
import { autoclaimMeteoraPositions } from "../controllers/meteora/autoclaim";
import { autoclaimRaydiumPositions } from "../controllers/raydium/autoclaim";
import { autocompoundMeteoraPositions } from "../controllers/meteora/autocompound";
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
  const startRebalanceTask = async (
    data: z.infer<typeof positionManagerWorkSchema>,
    positions: Position[],
  ) => {
    switch (data.dex) {
      case "orca": {
        return repositionOrcaPositions(
          {
            dex,
            secret,
            sender,
          },
          ...positions,
        );
      }
      case "meteora":
        return rebalanceMeteoraPositions(
          {
            dex,
            secret,
            sender,
          },
          ...positions,
        );
      case "raydium-clmm":
        return repositionRaydiumPositions(
          {
            dex,
            secret,
            sender,
          },
          ...positions,
        );
    }
  };

  const startClaimTask = async (
    data: z.infer<typeof positionManagerWorkSchema>,
    positions: Position[],
  ) => {
    switch (data.dex) {
      case "orca": {
        return autoclaimOrcaPositions(
          {
            dex,
            secret,
            sender,
          },
          ...positions,
        );
      }
      case "meteora":
        return autoclaimMeteoraPositions(
          {
            dex,
            secret,
            sender,
          },
          ...positions,
        );
      case "raydium-clmm":
        return autoclaimRaydiumPositions(
          {
            dex,
            secret,
            sender,
          },
          ...positions,
        );
    }
  };

  const startCompoundTask = async (
    data: z.infer<typeof positionManagerWorkSchema>,
    positions: Position[],
  ) => {
    switch (data.dex) {
      case "meteora":
        return autocompoundMeteoraPositions(
          {
            dex,
            secret,
            sender,
          },
          ...positions,
        );
    }
  };

  const worker = new Worker(
    Work.positionManager,
    async ({ data }: Job<z.infer<typeof positionManagerWorkSchema>>) => {
      logger.info({ data }, "position.manager.worker");
      const result = positionManagerWorkSchema.safeParse(data);

      if (result.success) {
        const data = result.data;
        const allPositions = await db.query.positions
          .findMany({
            columns: {
              id: true,
              pool: false,
              wallet: false,
              config: true,
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
            where: and(
              inArray(positions.id, data.positions),
              not(eq(positions.state, "closed")),
            ),
          })
          .execute();
        switch (data.type) {
          case "rebalance":
          case "reposition":
            return startRebalanceTask(data, allPositions);
          case "claim":
            return startClaimTask(data, allPositions);
          case "compound":
            return startCompoundTask(data, allPositions);
        }
      }
      logger.error(
        { data, error: result.error?.format() },
        "position.manager.worker.error",
      );
    },
    {
      concurrency: CONCURRENT_WORK,
      connection: createRedis({ maxRetriesPerRequest: null }),
    },
  );

  worker.on("completed", (job) => {
    logger.info(
      { id: job.id, data: job.data, returnvalue: job.returnvalue },
      "position.manager.worker.successful",
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
      "position.manager.worker.failed",
    );
  });
  worker.on("error", (error) => {
    logger.error({ error }, "position.manager.worker.error");
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
    sender,
    secret,
    logger,
    dex: new Dex(solanaConnection),
  }),
);
