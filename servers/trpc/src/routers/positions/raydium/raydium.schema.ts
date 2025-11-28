import z from "zod";
import { publicKey } from "@rhiva-ag/datasource";

import {
  externalTransactionSchema,
  jitoTipConfigSchema,
} from "../position.schema";

export const raydiumCreatePositionSchema = z
  .union([
    z.object({
      pair: publicKey().describe("pool address"),
      slippage: z.number().describe("swap slippage"),
      inputAmount: z.number().describe("input amount"),
      inputMint: publicKey().describe("input amount mint"),
      priceChanges: z.tuple([
        z.number().min(-1).max(0),
        z.number().min(0).max(1),
      ]),
    }),
    externalTransactionSchema.extend({ positionNftMint: publicKey() }),
  ])
  .and(
    z.object({
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
      jitoConfig: jitoTipConfigSchema.default({
        type: "dynamic",
        priorityFeePercentile: "50ema",
      }),
    }),
  );

export const raydiumClaimRewardSchema = z
  .union([
    z.object({
      pair: publicKey().describe("pool address"),
      slippage: z.number().describe("swap slippage"),
      position: publicKey().describe("position address"),
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

export const raydiumClosePositionSchema = z
  .union([
    z.object({
      pair: publicKey().describe("pool address"),
      slippage: z.number().describe("swap slippage"),
      position: publicKey().describe("position address"),
      swapToNative: z
        .boolean()
        .default(true)
        .optional()
        .describe("skip swapping to native mint"),
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

export const raydiumRebalanceSchema = z.union([
  z
    .object({
      pool: publicKey(),
      position: publicKey(),
      slippage: z.number().describe("swap slippage"),
    })
    .and(
      z.object({
        jitoConfig: jitoTipConfigSchema.default({
          type: "dynamic",
          priorityFeePercentile: "50ema",
        }),
      }),
    ),
  externalTransactionSchema,
]);
