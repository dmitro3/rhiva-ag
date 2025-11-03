import BN from "bn.js";
import Decimal from "decimal.js";
import type DLMM from "@meteora-ag/dlmm";
import {
  MAX_BINS_PER_POSITION,
  type LbPosition,
  type StrategyType,
} from "@meteora-ag/dlmm";
import {
  TransactionMessage,
  VersionedTransaction,
  type Keypair,
  type Connection,
  type PublicKey,
} from "@solana/web3.js";

export class MeteoraDLMM {
  constructor(private readonly connection: Connection) {}

  readonly buildCreatePosition = async ({
    priceChanges,
    position,
    owner,
    slippage,
    totalXAmount,
    totalYAmount,
    strategyType,
    pool,
  }: {
    pool: DLMM;
    totalXAmount: BN;
    totalYAmount: BN;
    position: PublicKey;
    owner: PublicKey;
    slippage: number;
    priceChanges: [number, number];
    strategyType: StrategyType;
  }) => {
    const activeBin = await pool.getActiveBin();
    const price = parseFloat(activeBin.price);

    const [lowerPriceChange, upperPriceChange] = priceChanges;

    const minPrice = price + price * lowerPriceChange;
    const maxPrice = price + price * upperPriceChange;

    const binIds = [
      pool.getBinIdFromPrice(minPrice, true),
      pool.getBinIdFromPrice(maxPrice, false),
    ];
    const minBinId = Math.min(...binIds);
    const maxBinId = Math.max(...binIds);

    const binCount = maxBinId - minBinId;

    if (binCount > MAX_BINS_PER_POSITION.toNumber()) {
      const transactions = await Promise.all([
        pool.createExtendedEmptyPosition(minBinId, maxBinId, position, owner),
        pool.addLiquidityByStrategy({
          slippage,
          user: owner,
          totalXAmount,
          totalYAmount,
          positionPubKey: position,
          strategy: {
            maxBinId,
            minBinId,
            strategyType,
            singleSidedX: totalXAmount.isZero() || totalYAmount.isZero(),
          },
        }),
      ]);

      return transactions.flatMap((transaction) => transaction.instructions);
    } else {
      const transaction =
        await pool.initializePositionAndAddLiquidityByStrategy({
          slippage,
          user: owner,
          totalXAmount,
          totalYAmount,
          positionPubKey: position,
          strategy: {
            maxBinId,
            minBinId,
            strategyType,
            singleSidedX: totalXAmount.isZero() || totalYAmount.isZero(),
          },
        });

      return transaction.instructions;
    }
  };

  readonly buildClaimReward = async ({
    pool,
    owner,
    position,
  }: {
    pool: DLMM;
    owner: PublicKey;
    position: LbPosition;
  }) => {
    return pool.claimAllRewardsByPosition({ owner, position });
  };

  readonly buildClosePosition = async ({
    position,
    owner,
    pool,
  }: {
    pool: DLMM;
    owner: PublicKey;
    position: LbPosition;
  }) => {
    const hasLiquidity = position.positionData.positionBinData.some(
      (bin) =>
        new Decimal(bin.binLiquidity).gt(0) ||
        bin.positionRewardAmount.some((amount) => new Decimal(amount).gt(0)) ||
        new Decimal(bin.positionFeeXAmount).gt(0) ||
        new Decimal(bin.positionFeeYAmount).gt(0),
    );

    if (hasLiquidity)
      return pool.removeLiquidity({
        user: owner,
        bps: new BN(100).muln(100),
        position: position.publicKey,
        shouldClaimAndClose: true,
        toBinId: position.positionData.upperBinId,
        fromBinId: position.positionData.lowerBinId,
      });
    return [
      await pool.closePositionIfEmpty({
        owner,
        position,
      }),
    ];
  };

  readonly buildRebalancePosition = async ({
    pool,
    owner,
    position,
    strategyType,
    slippage,
  }: {
    pool: DLMM;
    owner: Keypair;
    slippage: number;
    position: LbPosition;
    strategyType: StrategyType;
  }) => {
    const simulationResponse =
      await pool.simulateRebalancePositionWithBalancedStrategy(
        position.publicKey,
        position.positionData,
        strategyType,
        new BN(0),
        new BN(0),
        new BN(100).muln(100),
        new BN(100).muln(100),
      );
    const { initBinArrayInstructions, rebalancePositionInstruction } =
      await pool.rebalancePosition(
        simulationResponse,
        new BN(slippage),
        owner.publicKey,
        slippage,
      );
    const transactions = [];
    const { blockhash: recentBlockhash } =
      await this.connection.getLatestBlockhash();

    if (initBinArrayInstructions.length > 0)
      transactions.push(
        new VersionedTransaction(
          new TransactionMessage({
            recentBlockhash,
            payerKey: owner.publicKey,
            instructions: initBinArrayInstructions,
          }).compileToV0Message(),
        ),
      );
    if (rebalancePositionInstruction.length > 0)
      transactions.push(
        new VersionedTransaction(
          new TransactionMessage({
            recentBlockhash,
            payerKey: owner.publicKey,
            instructions: rebalancePositionInstruction,
          }).compileToV0Message(),
        ),
      );

    return transactions;
  };
}
