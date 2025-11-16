import Decimal from "decimal.js";
import type { z } from "zod/mini";
import { address } from "@solana/kit";
import { Percentage } from "@orca-so/whirlpools-sdk/common-sdk";
import { PublicKey, type VersionedTransaction } from "@solana/web3.js";
import { fetchWhirlpool } from "@orca-so/whirlpools-sdk/whirlpools-client";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import { getTokenBalanceChangesFromBundleSimulation } from "@rhiva-ag/dex/utils";
import {
  TickUtil,
  PriceMath,
  TokenExtensionUtil,
  increaseLiquidityQuoteByInputToken,
  type IncreaseLiquidityQuote,
} from "@orca-so/whirlpools-sdk";
import type {
  positionSelectSchema,
  settingsSelectSchema,
} from "@rhiva-ag/datasource";
import {
  isNative,
  throwBundleSimulationError,
  type SendTransaction,
  type WalletAdapter,
} from "@rhiva-ag/shared";

import type {
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
    const [lowerPriceChange, upperPriceChange] = args.priceChanges;

    const currentPrice = PriceMath.tickIndexToPrice(
      poolData.tickCurrentIndex,
      tokenAInfo.decimals,
      tokenBInfo.decimals,
    ).toNumber();

    lowerTick = TickUtil.getInitializableTickIndex(
      PriceMath.priceToTickIndex(
        new Decimal(currentPrice + currentPrice * lowerPriceChange),
        tokenAInfo.decimals,
        tokenBInfo.decimals,
      ),
      poolData.tickSpacing,
    );
    upperTick = TickUtil.getInitializableTickIndex(
      PriceMath.priceToTickIndex(
        new Decimal(currentPrice + currentPrice * upperPriceChange),
        tokenAInfo.decimals,
        tokenBInfo.decimals,
      ),
      poolData.tickSpacing,
    );
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

    // tokenB -> nativeMint
    // nativeMint -> tokenB
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

  const transactions = await wallet.signAllTransactions([
    ...createPositionV0Transactions,
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
    tokenA,
    tokenB,
    position,
    slippage,
    jitoConfig,
  }: Exclude<z.infer<typeof orcaClaimRewardSchema>, { transactions: string[] }>,
) => {
  const pool = await fetchWhirlpool(dex.dlmm.rpc, pair);
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
    new PublicKey(pool.data.tokenMintA),
    wallet.publicKey,
    false,
    new PublicKey(tokenA.owner),
  );
  const tokenBAta = getAssociatedTokenAddressSync(
    new PublicKey(pool.data.tokenMintB),
    wallet.publicKey,
    false,
    new PublicKey(tokenB.owner),
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
  const tokens = [tokenA, tokenB];

  for (const token of tokens) {
    if (!isNative(token.mint)) {
      const quoteAmount = tokenBalanceChanges[token.mint] ?? BigInt(0);
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
    tokenA,
    tokenB,
    jitoConfig,
    swapToNative,
    position: positionPubkey,
  }: Exclude<
    z.infer<typeof orcaClosePositionSchema>,
    { transactions: string[] }
  >,
) => {
  const pool = await dex.dlmm.orcaLegacy.client.getPool(pair);
  const position = await dex.dlmm.orcaLegacy.client.getPosition(positionPubkey);
  const poolData = pool.getData();

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
      new PublicKey(poolData.tokenMintA),
      wallet.publicKey,
      false,
      new PublicKey(tokenA.owner),
    );
    const tokenBAta = getAssociatedTokenAddressSync(
      new PublicKey(poolData.tokenMintB),
      wallet.publicKey,
      false,
      new PublicKey(tokenB.owner),
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

    const tokens = [tokenA, tokenB];

    for (const token of tokens) {
      if (!isNative(token.mint)) {
        const quoteAmount = tokenBalanceChanges[token.mint] ?? BigInt(0);
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

  const transactions = await wallet.signAllTransactions([
    ...closePositionV0Transactions,
    ...swapV0Transactions,
  ]);

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

export const rebalancePosition = async ({
  dex,
  wallet,
  sender,
  settings,
  position: offchainPosition,
}: {
  dex: Dex;
  wallet: WalletAdapter;
  sender: SendTransaction;
  position: z.infer<typeof positionSelectSchema>;
  settings: z.infer<typeof settingsSelectSchema>;
}) => {
  const {
    pool,
    position,
    swapV0Transactions,
    closePositionV0Transactions,
    tokenBalanceChanges,
  } = await closePosition(dex, sender, wallet, {
    slippage: settings.slippage,
    position: address(offchainPosition.id),
    pair: address(offchainPosition.pool.id),

    jitoConfig: { type: "dynamic", priorityFeePercentile: "75" },
    tokenA: {
      mint: address(offchainPosition.pool.baseToken.id),
      owner: address(offchainPosition.pool.baseToken.tokenProgram),
      decimals: offchainPosition.pool.baseToken.decimals,
    },
    tokenB: {
      mint: address(offchainPosition.pool.quoteToken.id),
      owner: address(offchainPosition.pool.quoteToken.tokenProgram),
      decimals: offchainPosition.pool.quoteToken.decimals,
    },
  });

  const poolData = pool.getData();
  const positionData = position.getData();
  const tokenAInfo = pool.getTokenAInfo();
  const tokenBInfo = pool.getTokenBInfo();
  const transactions = [...closePositionV0Transactions, ...swapV0Transactions];

  const tokenA =
    tokenBalanceChanges[offchainPosition.pool.baseToken.id] || BigInt(0);
  const tokenB =
    tokenBalanceChanges[offchainPosition.pool.quoteToken.id] || BigInt(0);

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
    Percentage.fromDecimal(new Decimal(settings.slippage * 100)),
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

  transactions.push(
    ...(await wallet.signAllTransactions(createPositionV0Transactions)),
  );
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
