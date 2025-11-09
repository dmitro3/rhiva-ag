import { tickIndexToPrice } from "@orca-so/whirlpools-sdk/whirlpools-core";
import type { Whirlpool } from "@orca-so/whirlpools-sdk/whirlpools-client";
import {
  closePositionInstructions,
  openPositionInstructions,
  harvestPositionInstructions,
  openFullRangePositionInstructions,
} from "@orca-so/whirlpools-sdk/whirlpools";
import type {
  Account,
  Address,
  GetAccountInfoApi,
  GetEpochInfoApi,
  GetMinimumBalanceForRentExemptionApi,
  GetMultipleAccountsApi,
  Rpc,
  TransactionSigner,
} from "@solana/kit";

type SharedBuildCreatePositionArgs = {
  tokenA: bigint;
  tokenB: bigint;
  pool: Account<Whirlpool, Address>;
  slippage: number;
  owner: TransactionSigner;
};

type BuildCreatePositionArgs = (
  | {
      strategyType: "Full";
    }
  | {
      strategyType: "Custom";
      tokenADecimals: number;
      tokenBDecimals: number;
      priceChanges: [number, number];
    }
) &
  SharedBuildCreatePositionArgs;

export class OrcaDLMM {
  constructor(
    private readonly rpc: Rpc<
      GetAccountInfoApi &
        GetMultipleAccountsApi &
        GetMinimumBalanceForRentExemptionApi &
        GetEpochInfoApi
    >,
  ) {}

  readonly buildCreatePosition = async (args: BuildCreatePositionArgs) => {
    const { pool, slippage, tokenA, tokenB } = args;
    if (args.strategyType === "Custom") {
      const [lowerPriceChange, upperPriceChange] = args.priceChanges;

      const currentPrice = tickIndexToPrice(
        pool.data.tickCurrentIndex,
        args.tokenADecimals,
        args.tokenBDecimals,
      );

      const lowerPrice = currentPrice + currentPrice * lowerPriceChange;
      const upperPrice = currentPrice + currentPrice * upperPriceChange;

      return openPositionInstructions(
        this.rpc,
        pool.address,
        { tokenA: args.tokenA, tokenB: args.tokenB },
        lowerPrice,
        upperPrice,
        slippage,
        args.owner,
      );
    }

    return openFullRangePositionInstructions(
      this.rpc,
      pool.address,
      {
        tokenA,
        tokenB,
      },
      slippage,
      args.owner,
    );
  };

  readonly buildClaimReward = async ({
    position,
    owner,
  }: {
    position: Address;
    owner: TransactionSigner;
  }) => {
    return harvestPositionInstructions(this.rpc, position, owner);
  };

  readonly buildClosePosition = async ({
    position,
    slippage,
    owner,
  }: {
    position: Address;
    slippage: number;
    owner: TransactionSigner;
  }) => {
    return closePositionInstructions(this.rpc, position, slippage, owner);
  };
}
