import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";

import { JWTAuthMiddleware, type User } from "./controllers";
import {
  drizzle,
  mcpClient,
  secret,
  coingecko,
  solanatracker,
  sendTransaction,
  solanaConnection,
  createRedis,
} from "./instances";

const redis = createRedis();
const authMiddlewares = [
  new JWTAuthMiddleware(redis, drizzle, {
    ttl: 86400,
  }),
];

export const createContext = async ({ req }: CreateFastifyContextOptions) => {
  let user: User | null | undefined;

  for (const authMiddleware of authMiddlewares) {
    user = await authMiddleware.getUser(req);
    if (user) break;
  }

  return {
    user,
    redis,
    secret,
    drizzle,
    coingecko,
    mcpClient,
    solanatracker,
    sendTransaction,
    connection: solanaConnection,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
