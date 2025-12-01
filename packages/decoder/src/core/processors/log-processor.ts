import { Consumer } from "./consumer";
import type { ParsedTransactionWithMeta } from "@solana/web3.js";

export abstract class LogProcessor<T> extends Consumer<
  (
    events: T[],
    extra: {
      signature: string;
      blockTime?: number | null;
      transaction: ParsedTransactionWithMeta;
    },
  ) => Promise<unknown>
> {
  type: "log" = "log";

  abstract process(logs?: string[]): T[] | null;
}
