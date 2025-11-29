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
    orcaInternalCreatePositionSchema,
    externalTransactionSchema.extend({
      positionMint: publicKey(),
    }),
  ])
  .and(
    z.object({
      skipSig: z.boolean().optional(),
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

export const orcaClosePositionSchema = z
  .union([
    z.object({
      skipSig: z.boolean().optional(),
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

export const orcaRepositionSchema = z.union([
  z
    .object({
      pair: publicKey(),
      position: publicKey(),
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
  externalTransactionSchema.extend({
    positionMint: publicKey(),
  }),
]);
