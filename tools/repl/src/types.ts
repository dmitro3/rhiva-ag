import type { Queue, RedisClient } from "bullmq";

export type Config = {
  queues: Queue[];
  createConnection: () => RedisClient;
};
