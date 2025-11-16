import z from "zod";
import { address, publicKey } from "@rhiva-ag/datasource";
import { externalTransactionSchema } from "../positions/position.schema";

export const tokenChartFilter = z.object({
  before_timestamp: z.number().optional(),
  currency: z.enum(["usd", "token"]).optional(),
  include_empty_intervals: z.boolean().optional(),
  limit: z.number().max(1000).default(100).optional(),
  token: z.enum(["base", "quote", "token"]).default("base").optional(),
  aggregate: z.enum(["1", "5", "4", "12", "15", "30"]).default("1").optional(),
});

export const tokenTradeFilter = z.object({
  token: tokenChartFilter.shape.token,
  trade_volume_in_usd_greater_than: z.number(),
});

export const tokenSwapSchema = z.union([
  z.object({
    amount: z.number(),
    slippage: z.number(),
    inputMint: address(),
    outputMint: address(),
    inputDecimals: z.number().int(),
    outputDecimals: z.number().int(),
  }),
  externalTransactionSchema,
]);

export const tokenSendSchema = z.union([
  z.object({
    inputMint: publicKey(),
    recipient: publicKey(),
    inputDecimals: z.number(),
    inputTokenProgram: publicKey(),
    inputAmount: z.union([z.number(), z.bigint()]),
  }),
  externalTransactionSchema,
]);
