import type { Database } from "@rhiva-ag/datasource";
import type { Connection, ParsedTransactionWithMeta } from "@solana/web3.js";
import type { ProgramInstructionType, TInstruction } from "@rhiva-ag/decoder";
import type { Whirlpool } from "@rhiva-ag/decoder/programs/idls/types/orca";

export const syncOrcaPositionStateFromInstructions = ({
  instructions,
}: {
  db: Database;
  connection: Connection;
  extra: { transaction: ParsedTransactionWithMeta };
  instructions: TInstruction<ProgramInstructionType<Whirlpool>>[];
}) => {
  for (const instruction of instructions) {
    if (["collectFees", "collectFeesV2"].includes(instruction.parsed.name)) {
    }
  }
};
