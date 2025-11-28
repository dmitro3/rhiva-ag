import type { z } from "zod";
import Decimal from "decimal.js";
import { Percentage } from "@orca-so/whirlpools-sdk/common-sdk";
import { PublicKey, type VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import { getTokenBalanceChangesFromBundleSimulation } from "@rhiva-ag/dex/utils";
import {
  TickUtil,
  PriceMath,
  TokenExtensionUtil,
  increaseLiquidityQuoteByInputToken,
  type IncreaseLiquidityQuote,
} from "@orca-so/whirlpools-sdk";
import {
  isNative,
  throwBundleSimulationError,
  type SendTransaction,
  type WalletAdapter,
} from "@rhiva-ag/shared";

import type {
  orcaRebalanceSchema,
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
  > & { skipSig?: boolean },
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

    const ticks = args.priceChanges.map((priceChange) =>
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

    const quoteResponse = await dex.swap.jupiter.jupiter.quoteGet({
      outputMint: NATIVE_MINT.toBase58(),
      inputMint: (baseIn
        ? poolData.tokenMintB
        : poolData.tokenMintA
      ).toString(),
      //@ts-expect-error
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
    jitoConfig,
  }: Exclude<z.infer<typeof orcaClaimRewardSchema>, { transactions: string[] }>,
) => {
  const pool = await dex.dlmm.orcaLegacy.client.getPool(pair);
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
    transactions: claimRewardV0Transactions,
    skipSigVerify: true,
    replaceRecentBlockhash: true,
    postExecutionAccountsConfigs: accountConfigs,
    preExecutionAccountsConfigs: accountConfigs,
  });

  throwBundleSimulationError(simulationResponse.result.value);

  const tokenBalanceChanges = getTokenBalanceChangesFromBundleSimulation(
    simulationResponse.result.value,
  );

  const swapV0Transactions = [];
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

  const transactions = await wallet.signAllTransactions([
    ...claimRewardV0Transactions,
    ...swapV0Transactions,
  ]);

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
    slippage,
    pair,
    skipSig,
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

    const accountConfigs = closePositionV0Transactions.map(() => ({
      encoding: "base64" as const,
      addresses: [tokenAAta.toBase58(), tokenBAta.toBase58()],
    }));
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
    replaceRecentBlockhash: true,
  });

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

export const rebalancePosition = async (
  dex: Dex,
  sender: SendTransaction,
  wallet: WalletAdapter,
  args: Exclude<
    z.infer<typeof orcaRebalanceSchema>,
    { transactions: string[] }
  >,
) => {
  const {
    pool,
    position,
    swapV0Transactions,
    closePositionV0Transactions,
    tokenBalanceChanges,
  } = await closePosition(dex, sender, wallet, {
    skipSig: true,
    pair: args.pool,
    slippage: args.slippage,
    position: args.position,
    jitoConfig: { type: "dynamic", priorityFeePercentile: "75" },
  });

  const poolData = pool.getData();
  const positionData = position.getData();
  const tokenAInfo = pool.getTokenAInfo();
  const tokenBInfo = pool.getTokenBInfo();

  const tokenA =
    tokenBalanceChanges[tokenAInfo.address.toBase58()] || BigInt(0);
  const tokenB =
    tokenBalanceChanges[tokenBInfo.address.toBase58()] || BigInt(0);

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

  const tokenExtension = await TokenExtensionUtil.buildTokenExtensionContext(
    dex.dlmm.orcaLegacy.fetcher,
    poolData,
  );
  const quote = increaseLiquidityQuoteByInputToken(
    tokenA > BigInt(0) ? poolData.tokenMintA : poolData.tokenMintB,
    new Decimal(tokenA > BigInt(0) ? tokenA : tokenB).div(
      Math.pow(
        10,
        tokenA > BigInt(0) ? tokenAInfo.decimals : tokenBInfo.decimals,
      ),
    ),
    lowerTick,
    upperTick,
    Percentage.fromDecimal(new Decimal(args.slippage)),
    pool,
    tokenExtension,
  );

  const { transactions: createPositionV0Transactions, positionMint } =
    await dex.dlmm.orcaLegacy.buildPreloadedCreatePosition({
      pool,
      quote,
      lowerTick,
      upperTick,
      owner: wallet.publicKey,
      inputMint: tokenA > BigInt(0) ? poolData.tokenMintA : poolData.tokenMintB,
    });

  const transactions = await wallet.signAllTransactions([
    ...closePositionV0Transactions,
    ...swapV0Transactions,
    ...createPositionV0Transactions,
  ]);
  const bundleSimulationResponse = await sender.simulateBundle({
    transactions,
    skipSigVerify: true,
  });

  throwBundleSimulationError(bundleSimulationResponse.result.value);

  return {
    positionMint,
    transactions,
    bundleSimulationResponse,
    async execute() {
      const { result } = await sender.sendBundle(transactions);
      return result;
    },
  };
};
