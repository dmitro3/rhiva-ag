import fastify from "fastify";
import { streamableHttp } from "fastify-mcp";

import { getEnv } from "./env";
import { createMcpServer } from "./server";
import { db, dexApi, coingecko } from "./instances";

const server = fastify({
  logger: true,
});

// @ts-expect-error
server.register(streamableHttp, {
  stateful: false,
  mcpEndpoint: "/",
  createServer: () =>
    createMcpServer({
      db,
      dexApi,
      coingecko,
    }),
});

server.listen({ port: getEnv<number>("PORT"), host: getEnv<string>("HOST") });
