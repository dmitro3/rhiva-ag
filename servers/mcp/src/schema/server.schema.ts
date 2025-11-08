import { z } from "zod/v3";

export const positionInputSchema = z.object({
  wallet: z.string().describe("user wallet address"),
});

export const tokenInputSchema = z.object({
  addresses: z
    .array(z.string())
    .optional()
    .describe("searching for multiple tokens by address."),
  limit: z
    .number()
    .describe("result limit count when category is not equal to search.")
    .default(8),
  query: z
    .union([z.enum(["verified", "lst"]), z.string()])
    .describe(
      "required when category is search or tag, required when addresses is not undefined.",
    )
    .optional(),
  timestamp: z
    .enum(["5m", "1h", "6h", "24h"])
    .describe(
      'Query by time interval for more accuracy. Required when category is "toporganicscore", "toptraded", "toptrending".',
    )
    .default("24h"),
  category: z
    .enum([
      "toporganicscore",
      "toptraded",
      "toptrending",
      "tag",
      "recent",
      "search",
    ])
    .describe(
      "Top tokens in different trading categories. Request tokens and their information by a tag. Returns tokens that recently had their first created pool. Request a search by token's symbol, name or mint address.",
    )
    .default("toptraded"),
});

export const poolInputSchema = z.object({
  token_addressses: z
    .array(z.string())
    .describe("use for fetching tokens for multiple tokens")
    .optional(),
  page: z.number().describe("page through results").optional(),
  query: z.string().describe("token name, symbol or address").optional(),
  reserve_in_usd_min: z.number().describe("minimum reserve in USD").optional(),
  reserve_in_usd_max: z.number().describe("maximum reserve in USD").optional(),
  fdv_usd_min: z
    .number()
    .describe("minimum fully diluted value in USD")
    .optional(),
  fdv_usd_max: z
    .number()
    .describe("maximum fully diluted value in USD")
    .optional(),
  tx_count_min: z
    .number()
    .int()
    .describe("minimum transaction count")
    .optional(),
  tx_count_max: z
    .number()
    .int()
    .describe("maximum transaction count")
    .optional(),
  h24_volume_usd_min: z
    .number()
    .describe("minimum 24hr volume in USD")
    .optional(),
  h24_volume_usd_max: z
    .number()
    .describe("maximum 24hr volume in USD")
    .optional(),
  pool_created_hour_min: z
    .number()
    .describe("minimum pool age in hours")
    .optional(),
  pool_created_hour_max: z
    .number()
    .describe("maximum pool age in hours")
    .optional(),
  buys_min: z
    .number()
    .int()
    .describe("minimum number of buy transactions")
    .optional(),
  buys_max: z
    .number()
    .int()
    .describe("maximum number of buy transactions")
    .optional(),
  sells_min: z
    .number()
    .int()
    .describe("minimum number of sell transactions")
    .optional(),
  sells_max: z
    .number()
    .int()
    .describe("minimum number of sell transactions")
    .optional(),
  networks: z
    .enum(["solana"])
    .describe("filter pools by networks")
    .default("solana"),
  buy_tax_percentage_min: z
    .number()
    .describe("minimum buy tax percentage")
    .optional(),
  buy_tax_percentage_max: z
    .number()
    .describe("maximum buy tax percentage")
    .optional(),
  sell_tax_percentage_min: z
    .number()
    .describe("minimum sell tax percentage")
    .optional(),
  sell_tax_percentage_max: z
    .number()
    .describe("maximum sell tax percentage")
    .optional(),
  include_unknown_honeypot_tokens: z
    .boolean()
    .describe(
      "when checks includes no_honeypot, set to true to also include 'unknown honeypot' tokens",
    )
    .optional(),
  buys_duration: z
    .enum(["5m", "1h", "6h", "24h"])
    .describe("duration for buy transactions metric")
    .optional(),
  sells_duration: z
    .enum(["5m", "1h", "6h", "24h"])
    .describe("duration for sell transactions metric")
    .optional(),
  tx_count_duration: z
    .enum(["5m", "1h", "6h", "24h"])
    .describe("duration for transaction count metric")
    .optional(),
  include: z
    .array(z.enum(["base_token", "quote_token", "dex", "network"]))
    .default(["base_token", "quote_token", "dex", "network"])
    .transform((input) => input.join(","))
    .describe("attributes to include"),
  dexes: z
    .array(z.enum(["orca", "saros-dlmm", "meteora", "raydium-clmm"]))
    .default(["orca", "meteora", "raydium-clmm"])
    .transform((input) => input.join(","))
    .describe("filter pools by Dexes."),
  checks: z
    .array(
      z.enum(["no_honeypot", "good_gt_score", "on_coingecko", "has_social"]),
    )
    .transform((input) => input.join(","))
    .optional(),
  sort: z
    .enum([
      "m5_trending",
      "h1_trending",
      "h6_trending",
      "h24_trending",
      "fdv_usd_asc",
      "fdv_usd_desc",
      "reserve_in_usd_asc",
      "reserve_in_usd_desc",
      "h24_tx_count_desc",
      "h24_volume_usd_desc",
      "pool_created_at_desc",
      "m5_price_change_percentage_asc",
      "h1_price_change_percentage_asc",
      "h6_price_change_percentage_asc",
      "h24_price_change_percentage_asc",
      "m5_price_change_percentage_desc",
      "h1_price_change_percentage_desc",
      "h6_price_change_percentage_desc",
      "h24_price_change_percentage_desc",
    ])
    .describe("sort the pools by field.")
    .optional(),
});

const tokenSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  symbol: z.string().optional().optional(),
  image: z.string().optional().optional(),
  decimals: z.number().int(),
  tokenProgram: z.string(),
  addressLookupTables: z.array(z.string()).optional(),
});

const statsSchema = z.object({
  priceChange: z.number().optional(),
  numBuys: z.number().optional(),
  numSells: z.number().optional(),
  numTraders: z.number().optional(),
  buyVolume: z.number().optional(),
  sellVolume: z.number().optional(),
  volumeChange: z.number().optional(),
  numNetBuyers: z.number().optional(),
  liquidityChange: z.number().optional(),
  numOrganicBuyers: z.number().optional(),
  buyOrganicVolume: z.number().optional(),
  sellOrganicVolume: z.number().optional(),
});

export const tokenOutputSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  icon: z.string().optional(),
  fdv: z.number().optional(),
  mcap: z.number().optional(),
  symbol: z.string().optional(),
  decimals: z.number().optional(),
  ctLikes: z.number().optional(),
  updatedAt: z.string().optional(),
  usdPrice: z.number().optional(),
  liquidity: z.number().optional(),
  priceBlockId: z.number().optional(),
  smartCtLikes: z.number().optional(),
  circSupply: z.number().optional(),
  totalSupply: z.number().optional(),
  tokenProgram: z.string().optional(),
  holderCount: z.number().optional(),
  organicScore: z.number().optional(),
  isVerified: z.boolean().optional(),
  cexes: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  stats5m: statsSchema.optional(),
  stats1h: statsSchema.optional(),
  stats6h: statsSchema.optional(),
  stats24h: statsSchema.optional(),
  organicScoreLabel: z.enum(["low", "medium", "high"]).optional(),
  audit: z
    .object({
      topHoldersPercentage: z.number().optional(),
      mintAuthorityDisabled: z.boolean().optional(),
      freezeAuthorityDisabled: z.boolean().optional(),
    })
    .optional(),
  firstPool: z
    .object({
      id: z.string().optional(),
      createdAt: z.string().optional(),
    })
    .optional(),
});

const pairSchema = z.object({
  address: z.string().optional(),
  name: z.string().optional(),
  symbol: z.string().optional(),
  decimals: z.number().optional(),
  image_url: z.string().nullable().optional(),
});

const transactionSchema = z.object({
  buys: z.number().optional(),
  sells: z.number().optional(),
  buyers: z.number().optional(),
  sellers: z.number().optional(),
});

export const poolOutputSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  pool_created_at: z.string().optional(),
  reserve_in_usd: z.string().optional(),
  base_token_price_usd: z.string().optional(),
  quote_token_price_usd: z.string().optional(),
  base_token_price_base_token: z.string().optional(),
  base_token: pairSchema.optional(),
  quote_token: pairSchema.optional(),
  dex: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
  quote_token_price_base_token: z.string().optional(),
  base_token_price_native_currency: z.string().optional(),
  quote_token_price_native_currency: z.string().optional(),
  volume_usd: z
    .object({
      h1: z.string().optional(),
      h24: z.string().optional(),
      h6: z.string().optional(),
      m15: z.string().optional(),
      m30: z.string().optional(),
      m5: z.string().optional(),
    })
    .optional(),
  price_change_percentage: z
    .object({
      h1: z.string().optional(),
      h24: z.string().optional(),
      h6: z.string().optional(),
      m15: z.string().optional(),
      m30: z.string().optional(),
      m5: z.string().optional(),
    })
    .optional(),
  transactions: z
    .object({
      m5: transactionSchema.optional(),
      m15: transactionSchema.optional(),
      m30: transactionSchema.optional(),
      h1: transactionSchema.optional(),
      h24: transactionSchema.optional(),
    })

    .optional(),
});

export const positionOutputSchema = z.object({
  id: z.string(),
  wallet: z.string(),
  config: z.unknown(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  amountUsd: z.number(),
  baseAmount: z.number(),
  quoteAmount: z.number(),
  baseToken: tokenSchema,
  quoteToken: tokenSchema,
  status: z.enum(["error", "pending", "successful"]),
  state: z.enum(["idle", "open", "rebalanced", "repositioned", "closed"]),
  pnl: z.object({
    feeUsd: z.number(),
    pnlUsd: z.number(),
    amountUsd: z.number(),
    createdAt: z.string(),
    rewardUsd: z.number(),
    claimedFeeUsd: z.number(),
    state: z.enum(["opened", "closed"]),
  }),
});

export const transactionOutputSchema = z.object({
  bundleId: z.string().describe("jito bundle id"),
});
