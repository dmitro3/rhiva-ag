import assert from "assert";
import BN from "bn.js";
import {
  TxVersion,
  SqrtPriceMath,
  LiquidityMath,
  getTransferAmountFeeV2,
  minExpirationTime,
  type Raydium,
  type GetAmountParams,
  type PoolInfoLayout,
  type ClmmPositionLayout,
  type PositionInfoLayout,
  type TransferFeeDataBaseType,
  type ApiV3PoolInfoConcentratedItem,
  type ReturnTypeGetLiquidityAmountOut,
} from "@raydium-io/raydium-sdk-v2";

type CreatePositionArgs = {
  inputMint: string;
  tickLower: number;
  tickUpper: number;
  quote: ReturnTypeGetLiquidityAmountOut;
  pool: Awaited<ReturnType<Raydium["clmm"]["getPoolInfoFromRpc"]>>;
};

export class RaydiumCLMM {
  readonly raydium: Raydium;

  constructor(raydium?: Raydium) {
    this.raydium = raydium!; // dangerous but we need too, assert for null runtime
  }

  readonly buildCreatePosition = async ({
    pool,
    inputMint,
    quote,
    tickUpper,
    tickLower,
  }: CreatePositionArgs) => {
    assert(this.raydium, "initialize raydium class to use this method");
    const { poolInfo, poolKeys } = pool;
    const baseIn = inputMint === poolInfo.mintA.address;

    return this.raydium.clmm.openPositionFromBase({
      poolInfo,
      poolKeys,
      tickLower,
      tickUpper,
      checkCreateATAOwner: true,
      base: baseIn ? "MintA" : "MintB",
      baseAmount: baseIn
        ? quote.amountSlippageA.amount
        : quote.amountSlippageB.amount,
      otherAmountMax: baseIn
        ? quote.amountSlippageB.amount
        : quote.amountSlippageA.amount,
      ownerInfo: {
        useSOLBalance: true,
      },
      txVersion: TxVersion.V0,
    });
  };

  readonly buildClaimReward = async ({
    poolInfo,
    position,
  }: {
    position: ClmmPositionLayout;
    poolInfo: ApiV3PoolInfoConcentratedItem;
  }) => {
    assert(this.raydium, "initialize raydium class to use this method");

    return this.raydium.clmm.harvestAllRewards({
      txVersion: TxVersion.V0,
      allPoolInfo: { [poolInfo.id]: poolInfo },
      allPositions: { [poolInfo.id]: [position] },
      ownerInfo: {
        useSOLBalance: true,
      },
    });
  };

  buildClosePosition = async ({
    poolInfo,
    position,
  }: {
    position: ClmmPositionLayout;
    poolInfo: ApiV3PoolInfoConcentratedItem;
  }) => {
    assert(this.raydium, "initialize raydium class to use this method");

    return this.raydium.clmm.decreaseLiquidity({
      poolInfo,
      amountMinA: new BN(0),
      amountMinB: new BN(0),
      ownerPosition: position,
      liquidity: position.liquidity,
      txVersion: TxVersion.V0,
      ownerInfo: {
        closePosition: true,
        useSOLBalance: true,
      },
    });
  };

  static getAmountsFromLiquidity({
    poolInfo,
    ownerPosition,
    liquidity,
    add,
    mintA,
    mintB,
    epochInfo,
  }: Omit<GetAmountParams, "poolInfo" | "slippage" | "ownerPosition"> & {
    ownerPosition: ReturnType<typeof PositionInfoLayout.decode>;
    mintA?: { extensions?: { feeConfig?: TransferFeeDataBaseType } } | null;
    mintB?: { extensions?: { feeConfig?: TransferFeeDataBaseType } } | null;
    poolInfo: Pick<ReturnType<typeof PoolInfoLayout.decode>, "sqrtPriceX64">;
  }) {
    const sqrtPriceX64 = poolInfo.sqrtPriceX64;
    const sqrtPriceX64A = SqrtPriceMath.getSqrtPriceX64FromTick(
      ownerPosition.tickLower,
    );
    const sqrtPriceX64B = SqrtPriceMath.getSqrtPriceX64FromTick(
      ownerPosition.tickUpper,
    );

    const amounts = LiquidityMath.getAmountsFromLiquidity(
      sqrtPriceX64,
      sqrtPriceX64A,
      sqrtPriceX64B,
      liquidity,
      add,
    );

    const [amountA, amountB] = [
      getTransferAmountFeeV2(
        amounts.amountA,
        mintA?.extensions?.feeConfig,
        epochInfo,
        true,
      ),
      getTransferAmountFeeV2(
        amounts.amountB,
        mintB?.extensions?.feeConfig,
        epochInfo,
        true,
      ),
    ];

    return {
      liquidity,
      amountA,
      amountB,
      expirationTime: minExpirationTime(
        amountA.expirationTime,
        amountB.expirationTime,
      ),
    };
  }
}
