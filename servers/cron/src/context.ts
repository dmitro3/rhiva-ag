import type Redis from "ioredis";
import type { Logger } from "pino";
import type Dex from "@rhiva-ag/dex";
import type { Database } from "@rhiva-ag/datasource";
import type { KMSSecret, Secret, SendTransaction } from "@rhiva-ag/shared";
import { db, dex, logger, secret, createRedis, sender } from "./instances";

export type Context = {
  dex: Dex;
  db: Database;
  redis: Redis;
  logger: Logger;
  sender: SendTransaction;
  secret: KMSSecret | Secret;
};

export const getContext = (): Context => {
  return {
    dex,
    db,
    logger,
    secret,
    sender,
    redis: createRedis(),
  };
};
