import path from "path";
import { readFileSync } from "fs";
import { describe, beforeAll, test, afterAll } from "bun:test";
import {
  MCPServerStreamableHttp,
  run,
  setDefaultOpenAIKey,
  setTracingExportApiKey,
} from "@openai/agents";

import { getEnv } from "../src/env";
import { McpClient } from "../src/client";
import { __srcdir } from "../src/instances";
import { agentOutputSchema } from "../src/schema/agent.schema";

setDefaultOpenAIKey(getEnv("OPEN_API_KEY"));
setTracingExportApiKey(getEnv("OPEN_API_KEY"));

describe("mcp", () => {
  let client: McpClient;
  let transport: MCPServerStreamableHttp;

  beforeAll(async () => {
    transport = new MCPServerStreamableHttp({
      url: getEnv("MCP_SERVER_URL"),
    });

    client = new McpClient(transport, {
      name: "RhivaAg",
    });
  });

  afterAll(async () => {
    await client.close();
  });

  test("get tokens", async () => {
    const agent = await client.createAgent(
      {
        instructions: readFileSync(
          path.join(__srcdir, "prompts/en/web3.txt"),
          "utf-8",
        ),
      },
      // @ts-expect-error zod type error
      agentOutputSchema,
    );

    const response = await run(agent, "What token should I lp for?");
    console.log(response.finalOutput, { depth: null });
  });
});
