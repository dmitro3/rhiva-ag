import Decimal from "decimal.js";
import { mapFilter } from "@rhiva-ag/shared";
import { Percentage } from "@orca-so/common-sdk";
import { tickIndexToPrice } from "@orca-so/whirlpools-core";
import { Transaction, type PublicKey } from "@solana/web3.js";
import {
  toTx,
  PDAUtil,
  PriceMath,
  TickUtil,
  WhirlpoolIx,
  type WhirlpoolContext,
  TokenExtensionUtil,
  increaseLiquidityQuoteByInputToken,
  decreaseLiquidityQuoteByLiquidity,
  type Whirlpool,
  type Position,
  type WhirlpoolClient,
  type WhirlpoolAccountFetcherInterface,
} from "@orca-so/whirlpools-sdk";

type SharedBuildCreatePositionArgs = {
  pool: Whirlpool;
  owner: PublicKey;
  slippage: number;
  inputAmount: bigint;
  inputMint: PublicKey;
};

type BuildCreatePositionArgs = (
  | {
      strategyType: "full";
    }
  | {
      strategyType: "custom";
      priceChanges: [number, number];
    }
) &
  SharedBuildCreatePositionArgs;

export class OrcaLegacyDLMM {
  readonly context: WhirlpoolContext;
  readonly fetcher: WhirlpoolAccountFetcherInterface;

  constructor(readonly client: WhirlpoolClient) {
    this.fetcher = this.client.getFetcher();
    this.context = this.client.getContext();
  }

  readonly buildCreatePosition = async (args: BuildCreatePositionArgs) => {
    const { pool, slippage, inputAmount, inputMint, owner } = args;

    const poolData = pool.getData();
    const poolTokenAInfo = pool.getTokenAInfo();
    const poolTokenBInfo = pool.getTokenBInfo();

    let lowerTick: number, upperTick: number;
    const transactions: Transaction[] = [];

    if (args.strategyType === "custom") {
      const [lowerPriceChange, upperPriceChange] = args.priceChanges;

      const currentPrice = tickIndexToPrice(
        poolData.tickCurrentIndex,
        poolTokenAInfo.decimals,
        poolTokenBInfo.decimals,
      );

      lowerTick = TickUtil.getInitializableTickIndex(
        PriceMath.priceToTickIndex(
          new Decimal(currentPrice + currentPrice * lowerPriceChange),
          poolTokenAInfo.decimals,
          poolTokenBInfo.decimals,
        ),
        poolData.tickSpacing,
      );
      upperTick = TickUtil.getInitializableTickIndex(
        PriceMath.priceToTickIndex(
          new Decimal(currentPrice + currentPrice * upperPriceChange),
          poolTokenAInfo.decimals,
          poolTokenBInfo.decimals,
        ),
        poolData.tickSpacing,
      );
      const taPdas = [
        PDAUtil.getTickArray(
          this.context.program.programId,
          pool.getAddress(),
          lowerTick,
        ),
        PDAUtil.getTickArray(
          this.context.program.programId,
          pool.getAddress(),
          upperTick,
        ),
      ];

      const uninitalizedTickArrays = mapFilter(
        await this.fetcher.getTickArrays(taPdas.map((pda) => pda.publicKey)),
        (ta, index) => {
          const pda = taPdas[index];
          if (pda && !ta)
            return {
              pda,
              startTickIndex: index === 0 ? lowerTick : upperTick,
            };
        },
      );

      transactions.push(
        ...uninitalizedTickArrays.map((ta) => {
          const txBuilder = toTx(
            this.context,
            WhirlpoolIx.initTickArrayIx(this.context.program, {
              funder: owner,
              tickArrayPda: ta.pda,
              whirlpool: pool.getAddress(),
              startTick: ta.startTickIndex,
            }),
          );

          return new Transaction().add(
            ...txBuilder.compressIx(true).cleanupInstructions,
          );
        }),
      );
    } else
      [lowerTick, upperTick] = TickUtil.getFullRangeTickIndex(
        poolData.tickSpacing,
      );

    const tokenExtension = await TokenExtensionUtil.buildTokenExtensionContext(
      this.client.getFetcher(),
      poolData,
    );

    const quote = increaseLiquidityQuoteByInputToken(
      inputMint,
      new Decimal(inputAmount),
      lowerTick,
      upperTick,
      Percentage.fromDecimal(new Decimal(slippage)),
      pool,
      tokenExtension,
    );

    const { tx, positionMint } = await pool.openPosition(
      lowerTick,
      upperTick,
      quote,
    );
    transactions.push(
      new Transaction().add(...tx.compressIx(true).cleanupInstructions),
    );

    return {
      transactions,
      positionMint,
    };
  };

  readonly buildPreloadedCreatePosition = async (
    args: Omit<BuildCreatePositionArgs, "priceChanges" | "strategyType"> & {
      lowerTick: number;
      upperTick: number;
    },
  ) => {
    const {
      pool,
      slippage,
      inputAmount,
      inputMint,
      owner,
      lowerTick,
      upperTick,
    } = args;
    const fetcher = this.client.getFetcher();
    const context = this.client.getContext();
    const poolData = pool.getData();

    const transactions: Transaction[] = [];

    const taPdas = [
      PDAUtil.getTickArray(
        context.program.programId,
        pool.getAddress(),
        lowerTick,
      ),
      PDAUtil.getTickArray(
        context.program.programId,
        pool.getAddress(),
        upperTick,
      ),
    ];

    const uninitalizedTickArrays = mapFilter(
      await fetcher.getTickArrays(taPdas.map((pda) => pda.publicKey)),
      (ta, index) => {
        const pda = taPdas[index];
        if (pda && !ta)
          return {
            pda,
            startTickIndex: index === 0 ? lowerTick : upperTick,
          };
      },
    );

    transactions.push(
      ...uninitalizedTickArrays.map((ta) => {
        const txBuilder = toTx(
          context,
          WhirlpoolIx.initTickArrayIx(context.program, {
            funder: owner,
            tickArrayPda: ta.pda,
            whirlpool: pool.getAddress(),
            startTick: ta.startTickIndex,
          }),
        );

        return new Transaction().add(
          ...txBuilder.compressIx(true).cleanupInstructions,
        );
      }),
    );

    const tokenExtension = await TokenExtensionUtil.buildTokenExtensionContext(
      this.client.getFetcher(),
      poolData,
    );

    const quote = increaseLiquidityQuoteByInputToken(
      inputMint,
      new Decimal(inputAmount),
      lowerTick,
      upperTick,
      Percentage.fromDecimal(new Decimal(slippage)),
      pool,
      tokenExtension,
    );

    const { tx, positionMint } = await pool.openPosition(
      lowerTick,
      upperTick,
      quote,
    );
    transactions.push(
      new Transaction().add(...tx.compressIx(true).cleanupInstructions),
    );

    return {
      transactions,
      positionMint,
    };
  };

  readonly buildClaimReward = async ({
    position: positionPubkey,
  }: {
    position: PublicKey;
  }) => {
    const position = await this.client.getPosition(positionPubkey);
    const transactions: Transaction[] = [];
    const collectFeeBuilder = await position.collectFees();
    transactions.push(
      new Transaction().add(
        ...collectFeeBuilder.compressIx(true).cleanupInstructions,
      ),
    );
    const collectRewardBuilder = await position.collectRewards();
    transactions.push(
      new Transaction().add(
        ...collectRewardBuilder.flatMap(
          (builder) => builder.compressIx(true).cleanupInstructions,
        ),
      ),
    );

    return transactions;
  };

  readonly buildClosePosition = async ({
    pool,
    slippage,
    position,
  }: {
    pool: Whirlpool;
    position: Position;
    slippage: number;
  }) => {
    const positionData = position.getData();
    const poolData = pool.getData();

    const transactions: Transaction[] = [];

    const claimTxs = await this.buildClaimReward({
      position: position.getAddress(),
    });
    const tokenExtension = await TokenExtensionUtil.buildTokenExtensionContext(
      this.client.getFetcher(),
      poolData,
    );
    const decreaseQuote = decreaseLiquidityQuoteByLiquidity(
      positionData.liquidity,
      Percentage.fromDecimal(new Decimal(slippage)),
      position,
      pool,
      tokenExtension,
    );

    const closePositionBuilders = await pool.closePosition(
      position.getAddress(),
      Percentage.fromDecimal(new Decimal(slippage)),
    );

    transactions.push(...claimTxs);
    if (positionData.liquidity.gtn(0)) {
      const decreaseLiquidityBuilder =
        await position.decreaseLiquidity(decreaseQuote);

      transactions.push(
        new Transaction().add(
          ...decreaseLiquidityBuilder.compressIx(true).cleanupInstructions,
        ),
      );
    }

    transactions.push(
      new Transaction().add(
        ...closePositionBuilders.flatMap(
          (builder) => builder.compressIx(true).cleanupInstructions,
        ),
      ),
    );

    return transactions;
  };
}
