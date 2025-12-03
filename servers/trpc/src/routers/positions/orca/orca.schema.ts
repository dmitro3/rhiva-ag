import z from "zod";
import { publicKey } from "@rhiva-ag/datasource";

import {
  jitoTipConfigSchema,
  externalTransactionSchema,
} from "../position.schema";

const orcaFullCreatePositionSchema = z.object({
  strategyType: z.literal("Full"),
});
const orcaCustomCreatePositionSchema = z
  .union([
    z.object({
      priceChanges: z.tuple([
        z.number().min(-1).max(0),
        z.number().min(0).max(1),
      ]),
    }),
    z.object({
      tickRange: z.tuple([z.number().min(-1).max(0), z.number().min(0).max(1)]),
    }),
  ])
  .and(
    z.object({
      strategyType: z.literal("Custom"),
    }),
  );

const orcaInternalCreatePositionSchema = z
  .union([orcaFullCreatePositionSchema, orcaCustomCreatePositionSchema])
  .and(
    z.object({
      pair: publicKey(),
      slippage: z.number(),
      inputAmount: z.number(),
      inputMint: publicKey(),
    }),
  );

export const orcaCreatePositionSchema = z
  .union([
    orcaInternalCreatePositionSchema.and(
      z.object({
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

export const orcaClaimRewardSchema = z
  .union([
    z.object({
      skipSig: z.boolean().optional(),
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

export const orcaClosePositionSchema = z.union([
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

export const orcaRepositionSchema = z
  .union([
    z
      .object({
        pair: publicKey(),
        type: z.enum(["swap", "swapless"]),
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
  ])
  .and(
    z.object({
      position: publicKey(),
    }),
  );
