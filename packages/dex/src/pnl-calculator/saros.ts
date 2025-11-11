import BN from "bn.js";
import { mapFilter } from "@rhiva-ag/shared";
import { Pipeline, type ProgramEventType } from "@rhiva-ag/decoder";
import type { LiquidityBook } from "@rhiva-ag/decoder/programs/idls/types/saros";
import type {
  Connection,
  ParsedTransactionWithMeta,
  PublicKey,
} from "@solana/web3.js";
import type { LiquidityBookServices } from "@saros-finance/dlmm-sdk";
import {
  SarosProgramEventProcessor,
  SarosProgramInstructionEventProcessor,
} from "@rhiva-ag/decoder/programs/saros/index";

export class SarosPnLExtractor {
  constructor(
    private readonly connection: Connection,
    readonly service: LiquidityBookServices,
  ) {}

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
        const extract = async (events: ProgramEventType<LiquidityBook>[]) => {
          for (const event of events) {
            switch (event.name) {
              case "positionCreationEvent":
              case "positionDecreaseEvent":
              case "positionIncreaseEvent": {
                return {
                  pair: event.data.pair,
                  position: event.data.position,
                };
              }
            }
          }
        };

        const pipeline = new Pipeline([
          new SarosProgramEventProcessor(connection).addConsumer(extract),
          new SarosProgramInstructionEventProcessor(connection).addConsumer(
            (instructions: { parsed: ProgramEventType<LiquidityBook> }[]) =>
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

      const extract = async (events: ProgramEventType<LiquidityBook>[]) => {
        for (const event of events) {
          switch (event.name) {
            case "positionIncreaseEvent": {
              const data = event.data;

              openAmountA = data.amountsX.reduceRight(
                (acc, cur) => acc.add(cur),
                openAmountA,
              );
              openAmountB = data.amountsY.reduceRight(
                (acc, cur) => acc.add(cur),
                openAmountB,
              );
              break;
            }

            case "positionDecreaseEvent": {
              const data = event.data;
              withdrawnAmountA = data.amountsX.reduceRight(
                (acc, cur) => acc.add(cur),
                withdrawnAmountB,
              );
              withdrawnAmountB = data.amountsY.reduceRight(
                (acc, cur) => acc.add(cur),
                withdrawnAmountA,
              );
            }
          }
        }
      };

      const pipeline = new Pipeline([
        new SarosProgramEventProcessor(connection).addConsumer(extract),
        new SarosProgramInstructionEventProcessor(connection).addConsumer(
          (instructions: { parsed: ProgramEventType<LiquidityBook> }[]) =>
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
      await SarosPnLExtractor.extractPositionInfoFromSignature(
        this.connection,
        signature,
      );

    return this.fromAddress(position);
  }

  async fromAddress(address: PublicKey) {
    const position = await this.service
      .getPositionAccount(address)
      .catch(() => null);
    const confirmedSignatureInfos =
      await this.service.connection.getSignaturesForAddress(address);
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
      return SarosPnLExtractor.extractAmountsFromTransactions(
        this.connection,
        ...transactions,
      );
  }
}
