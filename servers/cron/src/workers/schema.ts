import z from "zod";
import { address, walletSchema } from "@rhiva-ag/datasource";

import { supportedDexes } from "../constants";

export const transactionWorkSchema = z
  .union([
    z
      .union([
        z.object({
          dex: z.literal("meteora"),
        }),
        z.object({
          positionMint: address(),
          dex: z.enum(["orca", "raydium-clmm"]),
        }),
      ])
      .and(
        z.object({
          type: z.enum(["create-position", "repositioned", "claimed-rewards"]),
        }),
      ),
    z.object({
      dex: z.enum(["orca", "meteora", "raydium-clmm"]),
      type: z.enum(["closed-position", "rebalanced-position"]),
    }),
  ])
  .and(
    z.object({
      bundleId: z.string(),
      wallet: walletSchema.pick({ id: true, user: true }),
    }),
  );
export const transactionEventSchema = z
  .union([
    z.object({
      result: z.unknown().optional(),
      status: z.enum(["queued", "pending", "completed"]),
    }),
    z.object({
      status: z.literal("error"),
      failedReason: z.string().optional(),
      stacktrace: z.array(z.string()).optional(),
    }),
    z.object({
      status: z.literal("progress"),
    }),
  ])
  .and(
    z.object({
      jobId: z.string(),
      message: z.string().optional(),
      type: z.enum([
        "repositioned",
        "create-position",
        "closed-position",
        "rebalanced-position",
      ]),
    }),
  );

export const positionManagerWorkSchema = z
  .union([
    z.object({
      dex: z.enum(["meteora"]),
      type: z.enum(["compound"]),
    }),
    z.object({
      dex: z.enum(supportedDexes),
      type: z.enum(["claim", "reposition", "rebalance"]),
    }),
  ])
  .and(
    z.object({
      positions: z.array(address()),
    }),
  );
