import type { Logger } from "pino";
import { Queue, Worker } from "bullmq";

import { Work } from "../constants";
import { createRedis } from "../instances";

export default async function createRetrySchedule({
  logger,
}: {
  logger: Logger;
}) {
  const scheduleQueue = new Queue(Work.retry, {
    connection: createRedis(),
  });

  const retrySchedule = async () => {
    const queues: Queue[] = [
      new Queue(Work.syncTransaction, { connection: createRedis() }),
    ];
    return Promise.all(
      queues.map(async (queue) => {
        const jobs = await queue.getJobs("failed");
        return Promise.all(
          jobs.map(async (job) => {
            if (await job.isActive()) return;
            if (await job.isWaiting()) return;
            return job.retry();
          }),
        );
      }),
    );
  };

  const worker = new Worker(Work.retry, async () => retrySchedule(), {
    connection: createRedis({ maxRetriesPerRequest: null }),
  });

  worker.on("failed", (job, error) => {
    console.error(error);
    logger.error(
      {
        error,
        job: {
          id: job?.id,
          data: job?.data,
          failedReason: job?.failedReason,
          stack: job?.stacktrace,
        },
      },
      "worker.retry.failed",
    );
  });

  worker.on("error", (error) => {
    logger.error({ error }, "worker.retry.error");
  });

  if (!worker.isRunning()) await worker.run();

  scheduleQueue.add(
    Work.syncPositionSchedule,
    {},
    {
      removeOnFail: true,
      removeOnComplete: true,
      repeat: { every: 60_000 },
    },
  );

  return async () => {
    await worker.close();
    await scheduleQueue.close();

    await worker.disconnect();
    await scheduleQueue.disconnect();
  };
}
