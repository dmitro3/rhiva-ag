import type {
  SimulatedTransactionResponse,
  VersionedTransaction,
} from "@solana/web3.js";

import { mapFilter } from "../collection";
import type { SimulateBundleResponse } from ".";
import { formatProgramErrorFromSimulationBundleResponse } from "./format-simulation-error";

export class SimulationError extends Error {
  constructor(readonly logs: string[]) {
    super(logs.join("\n"));
  }
}

export const throwBundleSimulationError = (
  transactions: VersionedTransaction[],
  response: SimulateBundleResponse,
) => {
  if (
    typeof response.summary === "object" &&
    response.transactionResults.length < transactions.length
  ) {
    throw new SimulationError(
      formatProgramErrorFromSimulationBundleResponse(transactions, response),
    );
  }
};

// Todo: formatProgramErrorFromSimulationResponse
export function throwSimulationError(
  ...results: SimulatedTransactionResponse[]
) {
  const errors = results.filter((result) => result.err);
  if (errors.length > 0)
    throw new SimulationError(mapFilter(errors, (error) => error.logs).flat());
}
