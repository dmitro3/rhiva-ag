import { PublicKey } from "@solana/web3.js";
import { raydiumClosePositionSchema } from "../src/index.browser";
import type { z } from "zod";

raydiumClosePositionSchema.parse({
  pair: PublicKey.default.toBase58(),
  position: PublicKey.default.toBase58(),
  slippage: 100,
}) as Exclude<
  z.infer<typeof raydiumClosePositionSchema>,
  { transactions: string[] }
>;
