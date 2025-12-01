import type { web3 } from "@coral-xyz/anchor";
import type { ParsedTransactionWithMeta } from "@solana/web3.js";

import { Consumer } from "./consumer";

export type TInstruction<T> = Omit<
  web3.PartiallyDecodedInstruction,
  "data" | "accounts"
> & {
  parsed: T;
  accounts?: web3.PublicKey[];
};

type FnConsumer<T> = (
  instructions: (TInstruction<T> & { inner?: boolean; index?: number })[],
  extra: {
    signature: string;
    blockTime?: number | null;
    transaction: ParsedTransactionWithMeta;
  },
) => Promise<unknown>;

export abstract class InstructionProcessor<T> extends Consumer<FnConsumer<T>> {
  type: "instruction" = "instruction";

  abstract process(
    ...instructions: (
      | web3.ParsedInstruction
      | web3.PartiallyDecodedInstruction
    )[]
  ): TInstruction<T | null>[];
}
