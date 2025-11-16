import type z from "zod";
import { Queue, type DefaultJobOptions } from "bullmq";
import { type transactionWorkSchema, Work } from "@rhiva-ag/cron";

import { createRedis } from "../../instances";

export const createQueue = (options?: DefaultJobOptions) =>
  new Queue<z.infer<typeof transactionWorkSchema>>(Work.syncTransaction, {
    connection: createRedis(),
    defaultJobOptions: {
      attempts: 8,
      backoff: { type: "exponential", delay: 10_000 },
      ...options,
    },
  });
