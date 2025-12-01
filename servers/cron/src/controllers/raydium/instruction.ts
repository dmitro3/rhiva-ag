import type { Database } from "@rhiva-ag/datasource";
import type { AmmV3 } from "@rhiva-ag/decoder/programs/idls/types/raydium";
import type { Connection, ParsedTransactionWithMeta } from "@solana/web3.js";
import type { ProgramInstructionType, TInstruction } from "@rhiva-ag/decoder";

export const syncRaydiumPositionStateFromInstructions = ({
  instructions,
}: {
  db: Database;
  connection: Connection;
  extra: { transaction: ParsedTransactionWithMeta };
  instructions: TInstruction<ProgramInstructionType<AmmV3>>[];
}) => {
  for (const instruction of instructions) {
    if (
      ["collectFundFee", "collectRemainingRewards"].includes(
        instruction.parsed.name,
      )
    ) {
    }
  }
};
