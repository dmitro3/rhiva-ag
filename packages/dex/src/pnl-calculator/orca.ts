import BN from "bn.js";
import { mapFilter } from "@rhiva-ag/shared";
import { Pipeline, type ProgramEventType } from "@rhiva-ag/decoder";
import type { Whirlpool } from "@rhiva-ag/decoder/programs/idls/types/orca";
import type {
  Connection,
  ParsedTransactionWithMeta,
  PublicKey,
} from "@solana/web3.js";
import {
  WhirlpoolProgramEventProcessor,
  WhirlpoolProgramInstructionEventProcessor,
} from "@rhiva-ag/decoder/programs/orca/index";

export class OrcaPnLExtractor {
  constructor(private readonly connection: Connection) {}

  static async extractPositionInfoFromSignature(
    connection: Connection,
    ...signatures: string[]
  ) {
    const transactions = mapFilter(
      await connection.getParsedTransactions(signatures, {
        maxSupportedTransactionVersion: 0,
      }),
      (transaction) => transaction,
    );

    return new Promise<{ pair: PublicKey; position: PublicKey }>(
      (resolve, reject) => {
        const extract = async (events: ProgramEventType<Whirlpool>[]) => {
          for (const event of events) {
            switch (event.name) {
              case "liquidityIncreased":
              case "liquidityDecreased": {
                return {
                  pair: event.data.whirlpool,
                  position: event.data.position,
                };
              }
            }
          }
        };

        const pipeline = new Pipeline([
          new WhirlpoolProgramEventProcessor(connection).addConsumer(extract),
          new WhirlpoolProgramInstructionEventProcessor(connection).addConsumer(
            (instructions: { parsed: ProgramEventType<Whirlpool> }[]) =>
              extract(instructions.map((instruction) => instruction.parsed)),
          ),
        ]);

        return pipeline
          .process(...transactions)
          .then((results) => {
            const [result] = mapFilter(results, (result) => result);

            if (result) resolve(result);
            else reject(new Error("invalid signature type."));
          })
          .catch(reject);
      },
    );
  }

  static async extractAmountsFromTransactions(
    connection: Connection,
    ...transactions: ParsedTransactionWithMeta[]
  ) {
    return new Promise<{
      open: { amountA: BN; amountB: BN };
      close: { amountA: BN; amountB: BN };
    }>((resolve, reject) => {
      let openAmountA = new BN(0),
        openAmountB = new BN(0);
      let withdrawnAmountA = new BN(0),
        withdrawnAmountB = new BN(0);

      const extract = async (events: ProgramEventType<Whirlpool>[]) => {
        for (const event of events) {
          switch (event.name) {
            case "liquidityIncreased": {
              const data = event.data;
              openAmountA = openAmountA.add(data.tokenAAmount);
              openAmountB = openAmountB.add(data.tokenBAmount);
              break;
            }
            case "liquidityDecreased": {
              const data = event.data;
              withdrawnAmountA = withdrawnAmountA.add(data.tokenAAmount);
              withdrawnAmountB = withdrawnAmountB.add(data.tokenBAmount);
            }
          }
        }
      };

      const pipeline = new Pipeline([
        new WhirlpoolProgramEventProcessor(connection).addConsumer(extract),
        new WhirlpoolProgramInstructionEventProcessor(connection).addConsumer(
          (instructions: { parsed: ProgramEventType<Whirlpool> }[]) =>
            extract(instructions.map((instruction) => instruction.parsed)),
        ),
      ]);

      return pipeline
        .process(...transactions)
        .then(() => {
          resolve({
            open: { amountA: openAmountA, amountB: openAmountB },
            close: { amountA: withdrawnAmountA, amountB: withdrawnAmountB },
          });
        })
        .catch(reject);
    });
  }

  async fromSignature(signature: string) {
    const { position } =
      await OrcaPnLExtractor.extractPositionInfoFromSignature(
        this.connection,
        signature,
      );

    return this.fromAddress(position);
  }

  async fromAddress(address: PublicKey) {
    const position = null;
    const confirmedSignatureInfos =
      await this.connection.getSignaturesForAddress(address);
    const transactions = mapFilter(
      await this.connection.getParsedTransactions(
        confirmedSignatureInfos.map((signature) => signature.signature),
        {
          maxSupportedTransactionVersion: 0,
        },
      ),
      (transaction) => transaction,
    );
    if (position) {
      throw new Error("PnL check for open position not supported.");
    } else
      return OrcaPnLExtractor.extractAmountsFromTransactions(
        this.connection,
        ...transactions,
      );
  }
}
