import BN from "bn.js";
import { mapFilter } from "@rhiva-ag/shared";
import { Pipeline, type ProgramEventType } from "@rhiva-ag/decoder";
import type { LbClmm } from "@rhiva-ag/decoder/programs/idls/types/meteora";
import type {
  Connection,
  ParsedTransactionWithMeta,
  PublicKey,
} from "@solana/web3.js";
import {
  MeteoraProgramEventProcessor,
  MeteoraProgramInstructionEventProcessor,
} from "@rhiva-ag/decoder/programs/meteora/index";

export class MeteoraPnLExtractor {
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
        const extract = async (events: ProgramEventType<LbClmm>[]) => {
          for (const event of events) {
            switch (event.name) {
              case "positionCreate":
              case "addLiquidity":
              case "removeLiquidity":
              case "decreasePositionLength":
              case "increasePositionLength": {
                return {
                  pair: event.data.lbPair,
                  position: event.data.position,
                };
              }
            }
          }
        };
        const pipeline = new Pipeline([
          new MeteoraProgramEventProcessor(connection).addConsumer(extract),
          new MeteoraProgramInstructionEventProcessor(connection).addConsumer(
            (instructions: { parsed: ProgramEventType<LbClmm> }[]) =>
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
      const rewards: { rewardIndex: BN; amount: BN }[] = [];

      const extract = async (events: ProgramEventType<LbClmm>[]) => {
        for (const event of events) {
          switch (event.name) {
            case "addLiquidity": {
              const data = event.data;
              const [amountX, amountY] = data.amounts;
              if (amountX) openAmountA = openAmountA.add(amountX);
              if (amountY) openAmountB = openAmountB.add(amountY);
              break;
            }
            case "claimFee": {
              const data = event.data;
              withdrawnAmountA = withdrawnAmountA.add(data.feeX);
              withdrawnAmountB = withdrawnAmountB.add(data.feeY);
              break;
            }
            case "claimReward": {
              const data = event.data;
              rewards.push({
                amount: data.totalReward,
                rewardIndex: data.rewardIndex,
              });
              break;
            }
            case "removeLiquidity": {
              const data = event.data;
              const [amountX, amountY] = data.amounts;
              if (amountX) withdrawnAmountA = withdrawnAmountA.add(amountX);
              if (amountY) withdrawnAmountB = withdrawnAmountB.add(amountY);
            }
          }
        }
      };

      const pipeline = new Pipeline([
        new MeteoraProgramEventProcessor(connection).addConsumer(extract),
        new MeteoraProgramInstructionEventProcessor(connection).addConsumer(
          (instructions: { parsed: ProgramEventType<LbClmm> }[]) =>
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
      await MeteoraPnLExtractor.extractPositionInfoFromSignature(
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
      return MeteoraPnLExtractor.extractAmountsFromTransactions(
        this.connection,
        ...transactions,
      );
  }
}
