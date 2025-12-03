import z from "zod";
import { publicKey } from "@rhiva-ag/datasource";

import {
  externalTransactionSchema,
  jitoTipConfigSchema,
} from "../position.schema";

export const raydiumCreatePositionSchema = z
  .union([
    z
      .union([
        z.object({
          priceChanges: z.tuple([
            z.number().min(-1).max(0),
            z.number().min(0).max(1),
          ]),
        }),
        z.object({
          tickRange: z.tuple([
            z.number().min(-1).max(0),
            z.number().min(0).max(1),
          ]),
        }),
      ])
      .and(
        z.object({
          pair: publicKey().describe("pool address"),
          slippage: z.number().describe("swap slippage"),
          inputAmount: z.number().describe("input amount"),
          inputMint: publicKey().describe("input amount mint"),
          skipSig: z.boolean().optional(),
          jitoConfig: jitoTipConfigSchema.default({
            type: "dynamic",
            priorityFeePercentile: "50ema",
          }),
        }),
      ),
    externalTransactionSchema.extend({ position: publicKey() }),
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
    }),
  );

export const raydiumClaimRewardSchema = z
  .union([
    z.object({
      pair: publicKey().describe("pool address"),
      slippage: z.number().describe("swap slippage"),
      jitoConfig: jitoTipConfigSchema.default({
        type: "dynamic",
        priorityFeePercentile: "50ema",
      }),
      swapToNative: z
        .boolean()
        .default(true)
        .optional()
        .describe("swap to native mint"),
    }),
    externalTransactionSchema,
  ])
  .and(
    z.object({
      position: publicKey().describe("position address"),
    }),
  );

export const raydiumClosePositionSchema = z.union([
  z.object({
    skipSig: z.boolean().optional(),
    pair: publicKey().describe("pool address"),
    slippage: z.number().describe("swap slippage"),
    position: publicKey().describe("position address"),

    jitoConfig: jitoTipConfigSchema.default({
      type: "dynamic",
      priorityFeePercentile: "50ema",
    }),
    swapToNative: z
      .boolean()
      .default(true)
      .optional()
      .describe("swap to native mint"),
  }),
  externalTransactionSchema,
]);

export const raydiumRepositionSchema = z
  .union([
    z.object({
      pair: publicKey(),
      type: z.enum(["swap", "swapless"]),
      slippage: z.number().describe("swap slippage"),
      jitoConfig: jitoTipConfigSchema.default({
        type: "dynamic",
        priorityFeePercentile: "50ema",
      }),
    }),
    externalTransactionSchema,
  ])
  .and(
    z.object({
      position: publicKey(),
    }),
  );
