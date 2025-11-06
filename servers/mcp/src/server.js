import { z } from "zod/v3";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getPools, getWalletPositions } from "../../trpc/src/index.node"; // careful: importing via package.json result in cyclic dependency
import {
  tokenOutputSchema,
  tokenInputSchema,
  poolInputSchema,
  poolOutputSchema,
  positionInputSchema,
  positionOutputSchema,
} from "./schema/server.schema.ts";

/** @type {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} */
let server;

export const createMcpServer = ({ db, coingecko, dexApi }) => {
  if (server) return server.server;

  server = new McpServer({
    name: "rhivaAg",
    version: "0.0.0",
    websiteUrl: "https://rhiva.fun",
  });

  server.registerTool(
    "get_tokens",
    {
      title: "Fetch tokens",
      description: "Returns list of tokens from filters.",
      inputSchema: tokenInputSchema.shape,
      outputSchema: { result: z.array(tokenOutputSchema.partial()) },
    },
    async (args) => {
      const input = tokenInputSchema.parse(args);
      const response = await dexApi.jup.token.list(input);
      const tokens = z.array(tokenOutputSchema.partial()).parse(response);
      let result = [];

      if (args.category === "search") result = tokens.slice(0, 1);
      else result = tokens;

      return {
        structuredContent: { result },
        content: [{ type: "text", text: JSON.stringify({ result }) }],
      };
    },
  );

  server.registerTool(
    "get_pools",
    {
      title: "Fetch pools",
      description: "Return list of pools from filters.",
      inputSchema: poolInputSchema.shape,
      outputSchema: { result: z.array(poolOutputSchema.partial()) },
    },
    async (args) => {
      const input = poolInputSchema.parse(args);
      const response = await getPools(coingecko, {
        dexes: "raydium-clmm,meteora,orca,saros-dlmm",
        ...input,
        network: "solana",
        include: "base_token,quote_token,dex",
      });
      const result = z.array(poolOutputSchema.partial()).parse(response);
      return {
        structuredContent: { result },
        content: [{ type: "text", text: JSON.stringify({ result }) }],
      };
    },
  );

  server.registerTool(
    "get_positions",
    {
      title: "Fetch positions",
      description: "Return list of positions from filters.",
      inputSchema: positionInputSchema.shape,
      outputSchema: { result: z.array(positionOutputSchema) },
    },
    async (args) => {
      const input = positionInputSchema.parse(args);
      const response = await getWalletPositions(db, input.wallet);
      const result = z.array(positionOutputSchema.partial()).parse(response);

      return {
        structuredContent: { result },
        content: [{ type: "text", text: JSON.stringify({ result }) }],
      };
    },
  );

  return server.server;
};
