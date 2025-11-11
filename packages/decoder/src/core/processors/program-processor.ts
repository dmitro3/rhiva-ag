import { mapFilter } from "@rhiva-ag/shared";
import { base64, bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import {
  type Idl,
  type Program,
  type web3,
  BorshCoder,
  EventParser,
} from "@coral-xyz/anchor";

import { LogProcessor } from "./log-processor";
import { InstructionProcessor } from "./instruction-processor";
import type { ProgramEventType, ProgramInstructionType } from "./types";

abstract class SharedProgramInstance<
  T extends Idl,
  U,
> extends InstructionProcessor<U> {
  protected readonly coder: BorshCoder;

  constructor(
    protected readonly program: Program<T>,
    protected readonly extra: { name: string },
  ) {
    super();
    this.coder = new BorshCoder(this.program.idl);
  }

  isProgram(programId: web3.PublicKey) {
    return programId.equals(this.program.programId);
  }
}

export abstract class ProgramInstructionProcessor<
  T extends Idl,
> extends SharedProgramInstance<T, ProgramInstructionType<T>> {
  process(
    ...instructions: (
      | web3.ParsedInstruction
      | web3.PartiallyDecodedInstruction
    )[]
  ) {
    return mapFilter(instructions, (instruction, index) => {
      if ("data" in instruction && this.isProgram(instruction.programId)) {
        const parsed = this.coder.instruction.decode(
          instruction.data,
          "base58",
        ) as ProgramInstructionType<T> | null;

        return {
          parsed,
          index,
          program: this.extra.name,
          programId: instruction.programId,
          accounts: instruction.accounts,
        };
      }

      return null;
    });
  }
}

export abstract class ProgramInstructionEventProcessor<
  T extends Idl,
> extends SharedProgramInstance<T, ProgramEventType<T>> {
  process(
    ...instructions: (
      | web3.ParsedInstruction
      | web3.PartiallyDecodedInstruction
    )[]
  ) {
    return mapFilter(instructions, (instruction, index) => {
      if ("data" in instruction && this.isProgram(instruction.programId)) {
        const rawData = bs58.decode(instruction.data);
        const bs64 = base64.encode(rawData.subarray(8));
        const parsed = this.program.coder.events.decode(
          bs64,
        ) as ProgramEventType<T> | null;

        if (parsed)
          return {
            index,
            parsed,
            program: this.extra.name,
            programId: instruction.programId,
            accounts: instruction.accounts,
          };
      }

      return null;
    });
  }
}

export abstract class ProgramEventProcessor<T extends Idl> extends LogProcessor<
  ProgramEventType<T>
> {
  protected readonly coder: BorshCoder;

  constructor(
    protected readonly program: Program<T>,
    protected readonly extra: { name: string },
  ) {
    super();
    this.coder = new BorshCoder(this.program.idl);
  }

  process(logs?: string[]): ProgramEventType<T>[] | null {
    if (logs) {
      const eventParser = new EventParser(this.program.programId, this.coder);
      const events = Array.from(eventParser.parseLogs(logs));
      return events;
    }

    return null;
  }

  isProgram(programId: web3.PublicKey) {
    return programId.equals(this.program.programId);
  }
}
