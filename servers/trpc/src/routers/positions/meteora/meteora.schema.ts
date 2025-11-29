import z from "zod";
import { StrategyType } from "@meteora-ag/dlmm";
import { publicKey } from "@rhiva-ag/datasource";
import {
  jitoTipConfigSchema,
  externalTransactionSchema,
} from "../position.schema";

const meteoraInternalCreatePositionSchema = z.object({
  pair: publicKey().describe("pool address"),
  slippage: z.number().describe("swap slippage"),
  inputAmount: z.number().describe("input amount"),
  inputMint: publicKey().describe("input amount mint address"),
  strategyType: z
    .enum(["Spot", "Curve", "BidAsk"])
    .transform((value) => StrategyType[value])
    .describe("position strategyType type"),
  sides: z
    .array(publicKey())
    .min(1)
    .max(2)
    .describe(
      "pool pair tokens addresses. for single sided position provide only one mint",
    ),
  priceChanges: z
    .tuple([z.number().min(-1).max(0), z.number().min(0).max(1)])
    .describe(
      "price changes in fractional percentile to provide liquidity for.",
    ),
  liquidityRatio: z
    .tuple([z.number(), z.number()])
    .describe(
      "liquidity ratio to split liquidity into. required only for non single sided positions.",
    )
    .optional(),
});
export const meteoraCreatePositionSchema = z
  .union([meteoraInternalCreatePositionSchema, externalTransactionSchema])
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
export const meteoraClaimRewardSchema = z
  .union([
    z.object({
      pair: publicKey().describe("pair address"),
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

export const meteoraClosePositionSchema = z
  .union([
    z.object({
      pair: publicKey().describe("pair address"),
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

export const meteoraRebalanceSchema = z.union([
  z
    .object({
      pair: publicKey(),
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
