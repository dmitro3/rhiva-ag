import { Queue } from "bullmq";
import { Work } from "@rhiva-ag/cron";
import { render, type Config } from "@rhiva-ag/repl";

import { createRedis } from "./servers/cron/src/instances";

const connection = createRedis();

const config = {
  queues: [new Queue(Work.syncTransaction, { connection })],
  createConnection: () => createRedis(),
} satisfies Config;

render(config);
