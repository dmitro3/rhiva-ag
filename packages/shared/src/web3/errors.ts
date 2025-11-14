import type { Idl } from "@coral-xyz/anchor";
import type { SimulatedTransactionResponse } from "@solana/web3.js";
import type { IdlErrorCode } from "@coral-xyz/anchor/dist/cjs/idl";

import { mapFilter } from "../collection";
import type { SimulateBundleResponse } from ".";

export const NativeErrorCodes: Record<number, IdlErrorCode> = {
  1: {
    code: 1,
    name: "InsufficientFunds",
    msg: "Insufficient Funds",
  },
};

export class SimulationError extends Error {
  constructor(readonly logs: string[]) {
    super(logs.join("\n"));
  }
}

export const throwBundleSimulationError = ({
  summary,
  transactionResults,
}: SimulateBundleResponse) => {
  let logs: string[] | undefined;
  const errors = transactionResults.filter((result) => result.err);
  if (errors.length > 0) logs = errors.flatMap((error) => error.logs);

  if (!logs && typeof summary === "object")
    logs = summary.failed.error.TransactionFailure.filter(
      (failure) => typeof failure === "string",
    );

  if (logs && logs.length > 0) throw new SimulationError(logs);
};

export function throwSimulationError(
  ...results: SimulatedTransactionResponse[]
) {
  const errors = results.filter((result) => result.err);
  if (errors.length > 0)
    throw new SimulationError(mapFilter(errors, (error) => error.logs).flat());
}

export const parseErrorMessageFromLogs = (logs: string[], idls: Idl[]) => {
  const regex = /\b(0x[0-9a-fA-F]+|\d+)\b/g;
  const codes = new Set<number>();
  for (const log of logs) {
    const matches = log.matchAll(regex);
    for (const match of matches) {
      const raw = match[1];
      if (raw) {
        const code = raw?.startsWith("0x")
          ? parseInt(raw, 16)
          : parseInt(raw, 10);
        if (!Number.isNaN(code)) codes.add(code);
      }
    }
  }

  if (codes.size > 0) {
    return mapFilter(Array.from(codes), (code) => {
      const errMsgs = [];
      for (const idl of idls) {
        const error = idl.errors?.find((error) => error.code === code);
        if (error) errMsgs.push(error);
        else {
          const error = NativeErrorCodes[code];
          if (error) errMsgs.push(error);
        }
      }

      return errMsgs.length > 0 ? errMsgs : null;
    }).flat();
  }
};
