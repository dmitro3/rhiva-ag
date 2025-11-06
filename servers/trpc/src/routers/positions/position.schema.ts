import z from "zod";
import {
  whereOperator,
  orderByOperator,
  poolSelectSchema,
  positionSelectSchema,
} from "@rhiva-ag/datasource";

export const positionFilterSchema = z.object({
  dex: whereOperator(poolSelectSchema.shape.dex),
  state: whereOperator(positionSelectSchema.shape.state),
  status: whereOperator(positionSelectSchema.shape.status),
});

export const positionSortSchema = orderByOperator(
  z.enum(["createdAt", "amountUsd"]),
);

export const jitoTipConfigSchema = z.union([
  z.object({ type: z.literal("exact"), amountLamport: z.bigint() }),
  z.object({
    type: z.literal("dynamic"),
    priorityFeePercentile: z.enum(["25", "50", "75", "95", "99", "50ema"]),
  }),
]);

export const externalTransactionSchema = z.object({
  transactions: z.base64().array(),
});

export const positionRebalanceSchema = z
  .union([
    positionSelectSchema.pick({ id: true }),
    externalTransactionSchema.and(positionSelectSchema.pick({ id: true })),
  ])
  .and(
    z.object({
      jitoConfig: jitoTipConfigSchema.default({
        type: "dynamic",
        priorityFeePercentile: "50ema",
      }),
    }),
  );
