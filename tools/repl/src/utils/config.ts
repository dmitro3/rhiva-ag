import path from "path";
import { existsSync } from "fs";
import type { Queue, RedisClient } from "bullmq";

export type Config = {
  queues: Queue[];
  createConnection: () => RedisClient;
};

export const loadConfig = async (config = "bullmq.config.ts") => {
  const file = path.join(process.cwd(), config);
  if (existsSync(file)) {
    const config: Config = await import(file).then((module) => {
      if (module.default) return module.default;
      return module;
    });

    return config;
  }

  throw new Error(
    "unable to load config file. expected bullmq.config.ts in current directory.",
  );
};
