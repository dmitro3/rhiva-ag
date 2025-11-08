import { z } from "zod/v3";
import { mapFilter } from "@rhiva-ag/shared";
import type { DexApi } from "@rhiva-ag/dex-api";
import type { Database } from "@rhiva-ag/datasource";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type Coingecko from "@coingecko/coingecko-typescript";
import {
  McpServer,
  type RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";

import { getPools, getWalletPositions } from "../../trpc/src/index.node.ts"; // careful: importing via package.json result in cyclic dependency
import {
  tokenOutputSchema,
  tokenInputSchema,
  poolInputSchema,
  poolOutputSchema,
  positionInputSchema,
  positionOutputSchema,
} from "./schema/server.schema.ts";

let server: McpServer;

const jsonOutput = async <T extends object, U extends z.ZodType>(
  value: T,
  validator?: U,
) => {
  const result = validator ? await validator?.parseAsync(value) : value;
  return {
    structuredContent: { result },
    content: [{ type: "text" as const, text: JSON.stringify({ result }) }],
  } satisfies ReturnType<RegisteredTool["callback"]>;
};

export const createMcpServer = ({
  db,
  coingecko,
  dexApi,
}: {
  db: Database;
  coingecko: Coingecko;
  dexApi: DexApi;
}) => {
  if (server) return server.server;

  server = new McpServer({
    name: "rhivaAg",
    version: "0.0.0",
    websiteUrl: "https://rhiva.fun",
    capabilities: {
      tools: {},
      resources: {},
    },
  });

  server.registerTool(
    "get_tokens",
    {
      title: "Fetch tokens",
      description: "Returns list of tokens from filters.",
      inputSchema: tokenInputSchema.shape,
      outputSchema: { result: z.array(tokenOutputSchema) },
    },
    async ({ addresses, ...input }) => {
      let response: Awaited<ReturnType<typeof dexApi.jup.token.list>>;
      if (addresses)
        response = (
          await Promise.all(
            addresses.map((address) =>
              dexApi.jup.token.list({
                ...input,
                query: address,
              }),
            ),
          )
        ).flat();
      else response = await dexApi.jup.token.list(input);

      return jsonOutput(response, z.array(tokenOutputSchema));
    },
  );

  server.registerTool(
    "get_pools",
    {
      title: "Fetch pools",
      description: "Return list of pools from filters.",
      inputSchema: poolInputSchema.shape,
      outputSchema: { result: z.array(poolOutputSchema) },
    },
    async ({ token_addressses, ...input }) => {
      let response: Awaited<ReturnType<typeof getPools>>;
      if (token_addressses) {
        response = mapFilter(
          (
            await Promise.all(
              token_addressses.map(async (address) =>
                (
                  await getPools(coingecko, {
                    ...input,
                    query: address,
                  })
                )?.slice(0, 4),
              ),
            )
          ).flat(),
          (pools) => pools,
        );
      } else response = await getPools(coingecko, input);
      if (response) return jsonOutput(response, z.array(poolOutputSchema));
      throw new McpError(404, "pool not found");
    },
  );

  server.registerTool(
    "get_positions",
    {
      title: "Fetch positions",
      description: "Return list of positions from filters.",
      inputSchema: positionInputSchema.shape,
      outputSchema: {
        result: z.object({
          items: z.array(positionOutputSchema),
          total: z.number(),
        }),
      },
    },
    async (input) => {
      const response = await getWalletPositions(db, input.wallet);
      return jsonOutput(response);
    },
  );

  return server.server;
};
