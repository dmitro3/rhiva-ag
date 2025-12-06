import { BN } from "bn.js";
import assert from "assert";
import type { z } from "zod";
import Decimal from "decimal.js";
import { Percentage } from "@orca-so/whirlpools-sdk/common-sdk";
import { PublicKey, type VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import {
  increaseLiquidityQuoteByInputToken,
  PriceMath,
  TickUtil,
  TokenExtensionUtil,
  type IncreaseLiquidityQuote,
  type Whirlpool,
} from "@orca-so/whirlpools-sdk";
import {
  isNative,
  throwBundleSimulationError,
  getTokenBalanceChangesFromBundleSimulation,
  type WalletAdapter,
  type SendTransaction,
} from "@rhiva-ag/shared";

import type {
  orcaRepositionSchema,
  orcaClaimRewardSchema,
  orcaClosePositionSchema,
  orcaCreatePositionSchema,
} from "./orca.schema";

type Dex =
  | import("@rhiva-ag/dex").default
  | import("@rhiva-ag/dex/browser").default;

export const createPosition = async (
  dex: Dex,
  sender: SendTransaction,
  wallet: WalletAdapter,
  args: Exclude<
    z.infer<typeof orcaCreatePositionSchema>,
    { transactions: string[] }
  >,
) => {
  const { pair, inputAmount, inputMint, slippage, jitoConfig } = args;
  const pool = await dex.dlmm.orcaLegacy.client.getPool(pair);
  const poolData = pool.getData();
  const tokenAInfo = pool.getTokenAInfo();
  const tokenBInfo = pool.getTokenBInfo();

  let addLiquidityAmount = BigInt(0);
  const addLiquidityMint = isNative(poolData.tokenMintA)
    ? poolData.tokenMintA
    : isNative(poolData.tokenMintB)
      ? poolData.tokenMintB
      : poolData.tokenMintA;
  const baseIn = poolData.tokenMintA.equals(addLiquidityMint);

  const swapV0Transactions: VersionedTransaction[] = [];

  const tokenExtension = await TokenExtensionUtil.buildTokenExtensionContext(
    dex.dlmm.orcaLegacy.fetcher,
    poolData,
  );

  let lowerTick: number, upperTick: number;
  if (args.strategyType === "Custom") {
    const currentPrice = PriceMath.tickIndexToPrice(
      poolData.tickCurrentIndex,
      tokenAInfo.decimals,
      tokenBInfo.decimals,
    ).toNumber();

    const ticks =
      "tickRange" in args
        ? args.tickRange
        : args.priceChanges.map((priceChange) =>
            TickUtil.getInitializableTickIndex(
              PriceMath.priceToTickIndex(
                new Decimal(currentPrice + currentPrice * priceChange),
                tokenAInfo.decimals,
                tokenBInfo.decimals,
              ),
              poolData.tickSpacing,
            ),
          );
    lowerTick = Math.min(...ticks);
    upperTick = Math.max(...ticks);
  } else
    [lowerTick, upperTick] = TickUtil.getFullRangeTickIndex(
      poolData.tickSpacing,
    );

  let quote: IncreaseLiquidityQuote;

  if (isNative(inputMint)) {
    const amount = BigInt(
      new Decimal(inputAmount / 2).mul(Math.pow(10, 9)).toFixed(0),
    );

    if (isNative(addLiquidityMint)) addLiquidityAmount = amount;
    else {
      const { transaction, quoteResponse } = await dex.swap.jupiter.buildSwap({
        inputMint,
        slippage,
        amount,
        skipSimulation: true,
        owner: wallet.publicKey,
        outputMint: tokenAInfo.address,
      });

      addLiquidityAmount = BigInt(quoteResponse.inAmount);
      swapV0Transactions.push(transaction);
    }
    const decimals = baseIn ? tokenAInfo.decimals : tokenBInfo.decimals;
    quote = increaseLiquidityQuoteByInputToken(
      addLiquidityMint,
      new Decimal(addLiquidityAmount.toString()).div(Math.pow(10, decimals)),
      lowerTick,
      upperTick,
      Percentage.fromDecimal(new Decimal(slippage)),
      pool,
      tokenExtension,
    );

    const quoteResponse = await dex.swap.jupiter.quoteGet({
      outputMint: NATIVE_MINT.toBase58(),
      inputMint: (baseIn
        ? poolData.tokenMintB
        : poolData.tokenMintA
      ).toString(),
      amount: baseIn ? quote.tokenEstB.toString() : quote.tokenEstA.toString(),
    });

    const { transaction } = await dex.swap.jupiter.buildSwap({
      inputMint,
      slippage,
      skipSimulation: true,
      owner: wallet.publicKey,
      amount: quoteResponse.outAmount,
      outputMint: baseIn ? poolData.tokenMintB : poolData.tokenMintA,
    });

    swapV0Transactions.push(transaction);
  } else throw new Error("unsupported input mint");

  const tipInstruction = await sender.getJitoTipInstruction(
    wallet.publicKey,
    jitoConfig,
  );

  const { transactions: createPositionV0Transactions, positionMint } =
    await dex.dlmm.orcaLegacy.buildCreatePosition({
      ...args,
      pool,
      quote,
      lowerTick,
      upperTick,
      owner: wallet.publicKey,
      inputMint: addLiquidityMint,
      appendInstructions: tipInstruction,
    });

  const unsignedTransactions = [
    ...swapV0Transactions,
    ...createPositionV0Transactions,
  ];
  const transactions = args.skipSig
    ? unsignedTransactions
    : await wallet.signAllTransactions(unsignedTransactions);

  const bundleSimulationResponse = await sender.simulateBundle({
    transactions,
    skipSigVerify: true,
    replaceRecentBlockhash: true,
  });

  throwBundleSimulationError(bundleSimulationResponse.result.value);

  return {
    transactions,
    positionMint,
    bundleSimulationResponse,
    async execute() {
      const { result } = await sender.sendBundle(transactions);
      return result;
    },
  };
};

export const claimReward = async (
  dex: Dex,
  sender: SendTransaction,
  wallet: WalletAdapter,
  {
    pair,
    position,
    slippage,
    skipSig,
    jitoConfig,
    swapToNative,
    ...args
  }: Exclude<
    z.infer<typeof orcaClaimRewardSchema>,
    { transactions: string[] }
  > & { pool?: Whirlpool },
) => {
  const pool = args.pool
    ? args.pool
    : await dex.dlmm.orcaLegacy.client.getPool(pair);
  const tokenAInfo = pool.getTokenAInfo();
  const tokenBInfo = pool.getTokenBInfo();
  const tipInstruction = await sender.getJitoTipInstruction(
    wallet.publicKey,
    jitoConfig,
  );
  const claimRewardV0Transactions = await dex.dlmm.orcaLegacy.buildClaimReward({
    owner: wallet.publicKey,
    position: new PublicKey(position),
    prependInstructions: tipInstruction,
  });

  const swapV0Transactions = [];

  if (swapToNative) {
    const tokenAAta = getAssociatedTokenAddressSync(
      tokenAInfo.address,
      wallet.publicKey,
      false,
      tokenAInfo.tokenProgram,
    );
    const tokenBAta = getAssociatedTokenAddressSync(
      tokenBInfo.address,
      wallet.publicKey,
      false,
      tokenBInfo.tokenProgram,
    );

    const accountConfigs = claimRewardV0Transactions.map(() => ({
      encoding: "base64" as const,
      addresses: [tokenAAta.toBase58(), tokenBAta.toBase58()],
    }));

    const simulationResponse = await sender.simulateBundle({
      skipSigVerify: true,
      transactions: claimRewardV0Transactions.map((transaction) =>
        transaction.serialize().toBase64(),
      ),
      postExecutionAccountsConfigs: accountConfigs,
      preExecutionAccountsConfigs: accountConfigs,
    });
    throwBundleSimulationError(simulationResponse.result.value);

    const tokenBalanceChanges = getTokenBalanceChangesFromBundleSimulation(
      simulationResponse.result.value,
    );

    const tokens = [tokenAInfo, tokenBInfo];

    for (const token of tokens) {
      if (!isNative(token.mint)) {
        const quoteAmount =
          tokenBalanceChanges[token.address.toBase58()] ?? BigInt(0);
        if (quoteAmount > BigInt(0)) {
          const { transaction } = await dex.swap.jupiter.buildSwap({
            slippage,
            skipSimulation: true,
            owner: wallet.publicKey,
            outputMint: NATIVE_MINT,
            amount: quoteAmount.toString(),
            inputMint: new PublicKey(token.mint),
          });

          swapV0Transactions.push(transaction);
        }
      }
    }
  }

  const unsignedTransactions = [
    ...claimRewardV0Transactions,
    ...swapV0Transactions,
  ];
  const transactions = skipSig
    ? unsignedTransactions
    : await wallet.signAllTransactions(unsignedTransactions);

  const bundleSimulationResponse = await sender.simulateBundle({
    transactions,
    skipSigVerify: true,
    replaceRecentBlockhash: true,
  });

  throwBundleSimulationError(bundleSimulationResponse.result.value);

  return {
    transactions,
    bundleSimulationResponse,
    async execute() {
      const { result } = await sender.sendBundle(transactions);
      return result;
    },
  };
};

export const closePosition = async (
  dex: Dex,
  sender: SendTransaction,
  wallet: WalletAdapter,
  {
    pair,
    skipSig,
    slippage,
    jitoConfig,
    swapToNative,
    position: positionPubkey,
  }: Exclude<
    z.infer<typeof orcaClosePositionSchema>,
    { transactions: string[] }
  > & { skipSig?: boolean },
) => {
  const pool = await dex.dlmm.orcaLegacy.client.getPool(pair);
  const position = await dex.dlmm.orcaLegacy.client.getPosition(positionPubkey);
  const tokenAInfo = pool.getTokenAInfo();
  const tokenBInfo = pool.getTokenBInfo();

  const tipInstruction = await sender.getJitoTipInstruction(
    wallet.publicKey,
    jitoConfig,
  );
  const closePositionV0Transactions =
    await dex.dlmm.orcaLegacy.buildClosePosition({
      pool,
      position,
      slippage,
      owner: wallet.publicKey,
      prependInstructions: tipInstruction,
    });

  const swapV0Transactions = [];
  let tokenBalanceChanges: Record<string, bigint> = {};

  const tokenAAta = getAssociatedTokenAddressSync(
    tokenAInfo.address,
    wallet.publicKey,
    false,
    tokenAInfo.tokenProgram,
  );
  const tokenBAta = getAssociatedTokenAddressSync(
    tokenBInfo.address,
    wallet.publicKey,
    false,
    tokenBInfo.tokenProgram,
  );

  const accountConfigs = closePositionV0Transactions.map(() => ({
    encoding: "base64" as const,
    addresses: [tokenAAta.toBase58(), tokenBAta.toBase58()],
  }));

  if (swapToNative) {
    const simulationResponse = await sender.simulateBundle({
      transactions: closePositionV0Transactions,
      skipSigVerify: true,
      postExecutionAccountsConfigs: accountConfigs,
      preExecutionAccountsConfigs: accountConfigs,
    });

    throwBundleSimulationError(simulationResponse.result.value);

    tokenBalanceChanges = getTokenBalanceChangesFromBundleSimulation(
      simulationResponse.result.value,
    );

    const tokens = [tokenAInfo, tokenBInfo];

    for (const token of tokens) {
      if (!isNative(token.mint)) {
        const quoteAmount =
          tokenBalanceChanges[token.address.toBase58()] ?? BigInt(0);
        if (quoteAmount > BigInt(0)) {
          const { transaction } = await dex.swap.jupiter.buildSwap({
            slippage,
            skipSimulation: true,
            owner: wallet.publicKey,
            outputMint: NATIVE_MINT,
            amount: quoteAmount.toString(),
            inputMint: new PublicKey(token.mint),
          });
          swapV0Transactions.push(transaction);
        }
      }
    }
  }
  const unsignedTransactions = [
    ...closePositionV0Transactions,
    ...swapV0Transactions,
  ];
  const transactions = skipSig
    ? unsignedTransactions
    : await wallet.signAllTransactions(unsignedTransactions);

  const bundleSimulationResponse = await sender.simulateBundle({
    transactions,
    skipSigVerify: true,

    preExecutionAccountsConfigs: accountConfigs,
    postExecutionAccountsConfigs: accountConfigs,
  });

  if (!swapToNative)
    tokenBalanceChanges = getTokenBalanceChangesFromBundleSimulation(
      bundleSimulationResponse.result.value,
    );

  throwBundleSimulationError(bundleSimulationResponse.result.value);

  return {
    pool,
    position,
    transactions,
    tokenBalanceChanges,
    swapV0Transactions,
    closePositionV0Transactions,
    bundleSimulationResponse,
    async execute() {
      const { result } = await sender.sendBundle(transactions);
      return result;
    },
  };
};

export const reposition = async (
  dex: Dex,
  sender: SendTransaction,
  wallet: WalletAdapter,
  args: Exclude<
    z.infer<typeof orcaRepositionSchema>,
    { transactions: string[] }
  >,
) => {
  const swapToNative = args.type === "swap";
  const {
    pool,
    position,
    swapV0Transactions,
    closePositionV0Transactions,
    tokenBalanceChanges,
  } = await closePosition(dex, sender, wallet, {
    swapToNative,
    skipSig: true,
    pair: args.pair,
    slippage: args.slippage,
    position: args.position,
    jitoConfig: { type: "dynamic", priorityFeePercentile: "75" },
  });

  const poolData = pool.getData();
  const positionData = position.getData();
  const tokenAInfo = pool.getTokenAInfo();
  const tokenBInfo = pool.getTokenBInfo();

  const tickDelta = Math.ceil(
    Math.abs(positionData.tickUpperIndex - positionData.tickLowerIndex),
  );

  const lowerTick = TickUtil.getInitializableTickIndex(
    poolData.tickCurrentIndex - tickDelta,
    poolData.tickSpacing,
  );
  const upperTick = TickUtil.getInitializableTickIndex(
    poolData.tickCurrentIndex + tickDelta,
    poolData.tickSpacing,
  );

  let positionMint: PublicKey;
  let transactions: VersionedTransaction[];

  if (swapToNative) {
    const rawInputAmount = tokenBalanceChanges[NATIVE_MINT.toBase58()];
    assert(
      rawInputAmount && rawInputAmount > BigInt(0),
      "expect an amount > 0",
    );
    const inputAmount = new Decimal(rawInputAmount)
      .div(Math.pow(10, 9))
      .toNumber();
    const response = await createPosition(dex, sender, wallet, {
      inputAmount,
      skipSig: true,
      pair: args.pair,
      inputMint: NATIVE_MINT,
      strategyType: "Custom",
      slippage: args.slippage,
      jitoConfig: args.jitoConfig,
      tickRange: [lowerTick, upperTick],
    });

    positionMint = response.positionMint;
    transactions = [
      ...closePositionV0Transactions,
      ...swapV0Transactions,
      ...response.transactions,
    ];
  } else {
    const rawAmountA = tokenBalanceChanges[poolData.tokenMintA.toBase58()];
    const rawAmountB = tokenBalanceChanges[poolData.tokenMintB.toBase58()];
    assert(rawAmountA && rawAmountB, "expected not to be undefined");
    const amountMaxA = new BN(rawAmountA);
    const amountMaxB = new BN(rawAmountB);

    const tokenExtension = await TokenExtensionUtil.buildTokenExtensionContext(
      dex.dlmm.orcaLegacy.fetcher,
      poolData,
    );
    const quote = increaseLiquidityQuoteByInputToken(
      poolData.tokenMintA,
      new Decimal(amountMaxA.toString()).div(Math.pow(10, tokenAInfo.decimals)),
      lowerTick,
      upperTick,
      Percentage.fromDecimal(new Decimal(args.slippage)),
      pool,
      tokenExtension,
    );

    if (quote.tokenEstB.gt(amountMaxB) && !isNative(tokenBInfo.address)) {
      const mintBBalanceResponse = await dex.connection.getTokenAccountBalance(
        tokenBInfo.address,
      );
      const mintBBalance = new BN(mintBBalanceResponse.value.amount);
      if (quote.tokenEstB.gt(mintBBalance)) {
        const quoteResponse = await dex.swap.jupiter.quoteGet({
          slippageBps: args.slippage,
          outputMint: NATIVE_MINT.toBase58(),
          inputMint: tokenBInfo.address.toBase58(),
          amount: quote.tokenEstB.toString(),
        });

        const { transaction } = await dex.swap.jupiter.buildSwap({
          skipSimulation: true,
          owner: wallet.publicKey,
          slippage: args.slippage,
          amount: quoteResponse.outAmount,
          inputMint: quoteResponse.outputMint,
          outputMint: quoteResponse.inputMint,
        });

        swapV0Transactions.push(transaction);
      }
    }

    const response = await dex.dlmm.orcaLegacy.buildPreloadedCreatePosition({
      pool,
      quote,
      lowerTick,
      upperTick,
      owner: wallet.publicKey,
      inputMint: tokenAInfo.address,
    });

    positionMint = response.positionMint;
    transactions = [
      ...closePositionV0Transactions,
      ...swapV0Transactions,
      ...response.transactions,
    ];
  }

  transactions = await wallet.signAllTransactions(transactions);
  const bundleSimulationResponse = await sender.simulateBundle({
    transactions,
    skipSigVerify: true,
  });

  throwBundleSimulationError(bundleSimulationResponse.result.value);

  return {
    transactions,
    positionMint,
    bundleSimulationResponse,
    async execute() {
      const { result } = await sender.sendBundle(transactions);
      return result;
    },
  };
};
