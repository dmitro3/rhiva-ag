import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  type Transaction,
  type TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";

export const getUniqueInstructions = (
  units: number,
  ...transactions: Transaction[]
): TransactionInstruction[] => {
  const instructions: TransactionInstruction[] = [];
  const exists = new Set<string>();

  const closeAccountIxs: TransactionInstruction[] = [];

  for (const tx of transactions) {
    for (const ix of tx.instructions) {
      if (ix.programId.equals(ComputeBudgetProgram.programId)) continue;
      const key = JSON.stringify(
        ix.keys.map((key) => ({
          isSigner: key.isSigner,
          isWritable: key.isWritable,
          pubkey: key.pubkey.toBase58(),
        })),
      );

      if (ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
        if (exists.has(key)) continue;
        else exists.add(key);
      } else if (ix.programId.equals(TOKEN_PROGRAM_ID) && ix.data[0] === 9) {
        if (exists.has(key)) continue;
        else {
          exists.add(key);
          closeAccountIxs.push(ix);
          continue;
        }
      }

      instructions.push(ix);
    }
  }

  if (closeAccountIxs.length > 0) instructions.push(...closeAccountIxs);

  return [ComputeBudgetProgram.setComputeUnitLimit({ units }), ...instructions];
};
