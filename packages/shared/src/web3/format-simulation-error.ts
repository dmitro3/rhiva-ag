import { format, isString } from "util";
import { getProgramErrorMessage } from "@rhiva-ag/decoder";
import type { VersionedTransaction } from "@solana/web3.js";

import type { SimulateBundleResponse } from "./types";

// assume bundle processes transaction sequentially and exit when a current transaction processed fail
export function formatProgramErrorFromSimulationBundleResponse(
  transactions: VersionedTransaction[],
  response: SimulateBundleResponse,
) {
  const result: string[] = [];

  if (isString(response.summary))
    throw new Error("expected a object gets a string");

  const errors = [...response.summary.failed.error.TransactionFailure];
  for (const [index, transaction] of transactions.entries()) {
    const accountKeys = transaction.message.getAccountKeys();
    const transactionResult = response.transactionResults[index];
    if (transactionResult) continue;
    const failure = errors.pop(); // pop last message from list, helius rpc return text as last item in array
    if (isString(failure)) {
      const rawErrorCode = failure.match(/0x[0-9a-fA-F]+/)?.[0];
      const rawInstructionIndex = failure.match(/Instruction (\d+)/i)?.[1];
      if (rawInstructionIndex && rawErrorCode) {
        const errorCode = parseInt(rawErrorCode, 16);
        const instructionIndex = parseFloat(rawInstructionIndex);
        const instructions = transaction.message.compiledInstructions;
        const instruction = instructions[instructionIndex];
        if (instruction) {
          const programId = accountKeys
            .get(instruction.programIdIndex)
            ?.toBase58();
          if (programId) {
            const msg = getProgramErrorMessage({ programId, errorCode });
            if (msg) result.push(msg);
            else
              result.push(
                format("%s throw unknown error code %d", programId, errorCode),
              );
            break;
          }
        }

        result.push(failure);
      }
    }
  }

  return result;
}
