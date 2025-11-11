import BN from "bn.js";
import { mapFilter } from "@rhiva-ag/shared";
import { Pipeline, type ProgramEventType } from "@rhiva-ag/decoder";
import type { AmmV3 } from "@rhiva-ag/decoder/programs/idls/types/raydium";
import type {
  Connection,
  ParsedTransactionWithMeta,
  PublicKey,
} from "@solana/web3.js";
import {
  RaydiumProgramEventProcessor,
  RaydiumProgramInstructionEventProcessor,
} from "@rhiva-ag/decoder/programs/raydium/index";

export class RaydiumPnLExtractor {
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

    return new Promise<{ position: PublicKey }>((resolve, reject) => {
      const extract = async (events: ProgramEventType<AmmV3>[]) => {
        for (const event of events) {
          switch (event.name) {
            case "increaseLiquidityEvent":
            case "collectPersonalFeeEvent":
            case "decreaseLiquidityEvent": {
              return {
                position: event.data.positionNftMint,
              };
            }
          }
        }
      };

      const pipeline = new Pipeline([
        new RaydiumProgramEventProcessor(connection).addConsumer(extract),
        new RaydiumProgramInstructionEventProcessor(connection).addConsumer(
          (instructions: { parsed: ProgramEventType<AmmV3> }[]) =>
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
    });
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

      const extract = async (events: ProgramEventType<AmmV3>[]) => {
        for (const event of events) {
          switch (event.name) {
            case "increaseLiquidityEvent": {
              const data = event.data;
              openAmountA = openAmountA.add(data.amount0);
              openAmountB = openAmountB.add(data.amount1);
              break;
            }
            case "collectPersonalFeeEvent": {
              const data = event.data;
              withdrawnAmountA = withdrawnAmountA.add(data.amount0);
              withdrawnAmountB = withdrawnAmountB.add(data.amount1);
              break;
            }
            case "decreaseLiquidityEvent": {
              const data = event.data;
              withdrawnAmountA = withdrawnAmountA
                .add(data.decreaseAmount0)
                .add(data.feeAmount0)
                .add(data.transferFee0);
              withdrawnAmountB = withdrawnAmountB
                .add(data.decreaseAmount1)
                .add(data.feeAmount1)
                .add(data.transferFee1);
            }
          }
        }
      };

      const pipeline = new Pipeline([
        new RaydiumProgramEventProcessor(connection).addConsumer(extract),
        new RaydiumProgramInstructionEventProcessor(connection).addConsumer(
          (instructions: { parsed: ProgramEventType<AmmV3> }[]) =>
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
      await RaydiumPnLExtractor.extractPositionInfoFromSignature(
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
      return RaydiumPnLExtractor.extractAmountsFromTransactions(
        this.connection,
        ...transactions,
      );
  }
}
