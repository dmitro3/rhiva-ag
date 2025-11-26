import type z from "zod";
import { Queue, type DefaultJobOptions } from "bullmq";
import { type transactionWorkSchema, Work } from "@rhiva-ag/cron";

import { createRedis } from "../../instances";

export const createQueue = (options?: DefaultJobOptions) => {
  const connection = createRedis();
  const queue = new Queue<z.infer<typeof transactionWorkSchema>>(
    Work.syncTransaction,
    {
      connection,
      defaultJobOptions: {
        attempts: 8,
        backoff: { type: "exponential", delay: 10_000 },
        ...options,
      },
    },
  );

  const proxy = queue.add.bind(queue);
  queue.add = async (...[name, data, opts, ...args]) => {
    const [result] = await Promise.all([
      proxy(name, data, opts, ...args),
      connection.publish(
        Work.syncTransaction,
        JSON.stringify({
          jobId: opts?.jobId,
          type: data.type,
          status: "queued",
        }),
      ),
    ]);
    return result;
  };

  return queue;
};
