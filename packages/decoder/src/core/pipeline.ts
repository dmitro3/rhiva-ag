import assert from "assert";
import type { web3 } from "@coral-xyz/anchor";

import { LogProcessor } from "./processors/log-processor";
import { InstructionProcessor } from "./processors/instruction-processor";
import type { ConsumerReturnType } from "./processors/consumer";

export class Pipeline<T> {
  private readonly logPipes: LogProcessor<unknown>[];
  private readonly instructionPipes: InstructionProcessor<unknown>[];

  constructor(pipes: T[]) {
    this.logPipes = [];
    this.instructionPipes = [];

    for (const pipe of pipes) this.addPipes(pipe);
  }

  addPipes(pipe: T) {
    if (pipe instanceof InstructionProcessor) this.instructionPipes?.push(pipe);
    else if (pipe instanceof LogProcessor) this.logPipes?.push(pipe);
  }

  async process(
    ...parsedTransactionWithMetas: web3.ParsedTransactionWithMeta[]
  ) {
    const results = await Promise.all(
      parsedTransactionWithMetas.map((parsedTransactionWithMeta) => {
        const nestedInstructions = this.getNestedInstructions(
          parsedTransactionWithMeta,
        );

        const promiseJoins = [];
        const blockTime = parsedTransactionWithMeta.blockTime;
        const signature = parsedTransactionWithMeta.transaction.signatures[0]!;

        if (parsedTransactionWithMeta.meta?.logMessages && this.logPipes)
          promiseJoins.push(
            ...this.logPipes.map((pipe) => {
              const parsedEvents = pipe.process(
                parsedTransactionWithMeta.meta!.logMessages!,
              );
              if (parsedEvents && parsedEvents.length > 0)
                return pipe.consume(parsedEvents, {
                  signature,
                  transaction: parsedTransactionWithMeta,
                });

              return null;
            }),
          );
        if (this.instructionPipes) {
          promiseJoins.push(
            ...this.instructionPipes.map((pipe) => {
              const parsedInstructions = pipe.process(...nestedInstructions);
              if (parsedInstructions.length > 0)
                return pipe.consume(parsedInstructions, {
                  signature,
                  blockTime,
                  transaction: parsedTransactionWithMeta,
                });
              return null;
            }),
          );
        }

        return Promise.all(promiseJoins.filter(Boolean));
      }),
    );

    return results.flat(2) as unknown as Promise<
      FlatArray<Awaited<ConsumerReturnType<T>>, 2>[]
    >;
  }

  protected getNestedInstructions(
    parsedTransactionWithMeta: web3.ParsedTransactionWithMeta,
  ) {
    assert(parsedTransactionWithMeta.meta, "meta expected in transaction");

    const nestedInstructions: (
      | web3.ParsedInstruction
      | web3.PartiallyDecodedInstruction
    )[] = [...parsedTransactionWithMeta.transaction.message.instructions];

    const { innerInstructions } = parsedTransactionWithMeta.meta;

    if (innerInstructions)
      for (const { instructions } of innerInstructions)
        nestedInstructions.push(...instructions);

    return nestedInstructions;
  }
}
