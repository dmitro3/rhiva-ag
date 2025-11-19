import z from "zod";
import { address, publicKey } from "@rhiva-ag/datasource";

import {
  jitoTipConfigSchema,
  externalTransactionSchema,
} from "../position.schema";

const orcaFullCreatePositionSchema = z.object({
  strategyType: z.literal("Full"),
});
const orcaCustomCreatePositionSchema = z.object({
  strategyType: z.literal("Custom"),
  tokenADecimals: z.number(),
  tokenBDecimals: z.number(),
  priceChanges: z.tuple([z.number().min(-1).max(0), z.number().min(0).max(1)]),
});

const orcaInternalCreatePositionSchema = z
  .union([orcaFullCreatePositionSchema, orcaCustomCreatePositionSchema])
  .and(
    z.object({
      pair: address(),
      slippage: z.number(),
      inputAmount: z.number(),
      inputMint: publicKey(),
    }),
  );

export const orcaCreatePositionSchema = z
  .union([
    orcaInternalCreatePositionSchema,
    externalTransactionSchema.extend({
      positionMint: address(),
    }),
  ])
  .and(
    z.object({
      jitoConfig: jitoTipConfigSchema.default({
        type: "dynamic",
        priorityFeePercentile: "50ema",
      }),
      tokens: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            image: z.string(),
            symbol: z.string(),
            decimals: z.number(),
            tokenProgram: z.string(),
          }),
        )
        .optional()
        .describe("internal use only"),
    }),
  );

export const orcaClaimRewardSchema = z
  .union([
    z.object({
      pair: address().describe("pool address"),
      slippage: z.number().describe("swap slippage"),
      position: address().describe("position address"),
      tokenA: z.object({
        mint: address().describe("pool base token mint address"),
        owner: address().describe("pool base token program address"),
        decimals: z.number().describe("pool base token decimals"),
      }),
      tokenB: z.object({
        mint: address().describe("pool quote token mint address"),
        owner: address().describe("pool quote token program address"),
        decimals: z.number().int().describe("pool quote token decimals"),
      }),
    }),
    externalTransactionSchema,
  ])
  .and(
    z.object({
      jitoConfig: jitoTipConfigSchema.default({
        type: "dynamic",
        priorityFeePercentile: "50ema",
      }),
    }),
  );

export const orcaClosePositionSchema = z
  .union([
    z.object({
      pair: address().describe("pool address"),
      slippage: z.number().describe("swap slippage"),
      position: address().describe("position address"),
      swapToNative: z
        .boolean()
        .default(true)
        .optional()
        .describe("skip swapping to native mint"),
      tokenA: z.object({
        mint: address().describe("pool base token mint address"),
        owner: address().describe("pool base token program address"),
        decimals: z.number().describe("pool base token decimals"),
      }),
      tokenB: z.object({
        mint: address().describe("pool quote token mint address"),
        owner: address().describe("pool quote token program address"),
        decimals: z.number().int().describe("pool quote token decimals"),
      }),
    }),
    externalTransactionSchema,
  ])
  .and(
    z.object({
      jitoConfig: jitoTipConfigSchema.default({
        type: "dynamic",
        priorityFeePercentile: "50ema",
      }),
    }),
  );
