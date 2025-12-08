import { isObject, isString } from "util";
import type { VersionedTransaction } from "@solana/web3.js";
import type { SimulateBundleResponse } from "./types";

export function formatBundleSimulationError(
  transactions: VersionedTransaction[],
  response: SimulateBundleResponse,
) {
  if (isString(response.summary)) return;
  const errors = [response.summary.failed.error.TransactionFailure];
  for (const [index, transaction] of transactions.entries()) {
    const transactionResult = response.transactionResults[index];
    if (transactionResult) continue;
    const error = errors.pop();
  }
}
