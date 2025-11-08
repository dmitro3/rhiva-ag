import { z } from "zod/v3";

const poolOutputSchema = z.object({
  name: z.string().describe("pool name"),
  address: z.string().describe("pool address from mcp server"),
  baseToken: z
    .object({
      address: z.string().describe("base_token address from mcp server"),
      name: z.string().describe("base_token name from mcp server"),
      symbol: z.string().describe("base_token symbol from mcp server"),
      decimals: z.number().describe("base_token decimals from mcp server"),
      imageUrl: z.string().describe("base_token image_url from mcp server"),
    })
    .optional()
    .nullable(),
  quoteToken: z
    .object({
      address: z.string().describe("quote_token address from mcp server"),
      name: z.string().describe("quote_token name from mcp server"),
      symbol: z.string().describe("quote_token symbol from mcp server"),
      decimals: z.number().describe("quote_token decimals from mcp server"),
      imageUrl: z.string().describe("quote_token image_url from mcp server"),
    })
    .optional()
    .nullable(),
  dex: z.object({
    id: z.string().describe("pool dex id from mcp server"),
    name: z.string().describe("pool dex name from mcp server"),
  }),
  analysis: z.object({
    riskScore: z.number().gt(0).max(10).describe("agent risk score."),
    confidence: z.number().gt(0).max(1).describe("agent confidence."),
    suggestedStrategy: z
      .enum(["Spot", "Full", "Custom", "Curve", "BidAsk"])
      .describe(
        "agent suggested strategy. Orca supports Full and Custom only. Raydium supports Spot only.",
      ),
    suggestedDeposit: z.number().describe("agent suggested deposit."),
    estimatedEarnPerDay: z
      .number()
      .min(0)
      .max(1)
      .describe("agent suggested earning per day in percentage."),
    priceRange: z
      .array(z.number().gt(0).max(1))
      .length(2)
      .describe("agent suggested price change range to provide liquidity for."),
  }),
});

const tokenOutputSchema = z.object({
  name: z.string().describe("base token name from mcp server."),
  symbol: z.string().describe("base token symbol from mcp server."),
  address: z.string().describe("token address from mcp server"),
  image: z.string().describe("quote token image from mcp server."),
  analysis: z.object({
    riskScore: z.number().gt(0).max(10).describe("agent token risk score."),
    confidence: z.number().gt(0).max(1).describe("agent confidence."),
    suggestedDeposit: z.number().gt(0).describe("agent suggested deposit."),
    estimatedEarnPerDay: z
      .number()
      .gt(0)
      .max(1)
      .describe("agent suggested earning per day in percentage."),
  }),
});

export const agentOutputSchema = z.object({
  summary: z
    .string()
    .optional()
    .nullable()
    .describe("short summary of response."),
  tokens: z
    .array(tokenOutputSchema)
    .describe("recommended tokens.")
    .optional()
    .nullable(),
  pools: z
    .array(poolOutputSchema)
    .optional()
    .nullable()
    .describe("recommended pools."),
});
