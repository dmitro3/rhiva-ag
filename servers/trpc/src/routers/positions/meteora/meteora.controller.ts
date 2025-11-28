import BN from "bn.js";
import Decimal from "decimal.js";
import type { z } from "zod/mini";
import DLMM, { StrategyType } from "@meteora-ag/dlmm";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import { getTokenBalanceChangesFromBundleSimulation } from "@rhiva-ag/dex/utils";
import {
  isNative,
  throwBundleSimulationError,
  type SendTransaction,
  type WalletAdapter,
} from "@rhiva-ag/shared";
import {
  Keypair,
  type PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import type {
  meteoraClaimRewardSchema,
  meteoraClosePositionSchema,
  meteoraCreatePositionSchema,
  meteoraRebalanceSchema,
} from "./meteora.schema";

type Dex =
  | import("@rhiva-ag/dex").default
  | import("@rhiva-ag/dex/browser").default;

export const createPosition = async (
  dex: Dex,
  sender: SendTransaction,
  wallet: WalletAdapter,
  {
    pair,
    sides,
    inputMint,
    inputAmount,
    slippage,
    jitoConfig,
    priceChanges,
    strategyType,
    liquidityRatio,
  }: Exclude<
    z.infer<typeof meteoraCreatePositionSchema>,
    { transactions: string[] }
  >,
) => {
  const pool = await DLMM.create(dex.connection, pair);

  let totalXAmount = new BN(0),
    totalYAmount = new BN(0);

  const swapV0Transactions: VersionedTransaction[] = [];
  const tokenXMint = pool.tokenX.mint.address,
    tokenYMint = pool.tokenY.mint.address;

  if (isNative(inputMint)) {
    for (const [index, side] of sides.entries()) {
      const ratio = liquidityRatio ? liquidityRatio[index]! : 1;
      const amount = new BN(
        new Decimal(inputAmount * ratio).mul(Math.pow(10, 9)).toFixed(0),
      );
      if (isNative(side)) {
        if (side.equals(tokenXMint)) totalXAmount = amount;
        else if (side.equals(tokenYMint)) totalYAmount = amount;
      } else {
        const { quoteResponse, transaction } = await dex.swap.jupiter.buildSwap(
          {
            slippage,
            inputMint,
            outputMint: side,
            skipSimulation: true,
            owner: wallet.publicKey,
            amount: BigInt(amount.toString()),
          },
        );
        const inputAmount = BigInt(quoteResponse.outAmount);
        if (inputAmount > BigInt(0))
          if (side.equals(tokenXMint)) {
            totalXAmount = new BN(inputAmount);
            swapV0Transactions.push(transaction);
          } else if (side.equals(tokenYMint)) {
            totalYAmount = new BN(inputAmount.toString());
            swapV0Transactions.push(transaction);
          }
      }
    }
  } else throw new Error("unsupported input mint");

  const position = Keypair.generate();

  let createPositionInstructions = await dex.dlmm.meteora.buildCreatePosition({
    pool,
    slippage,
    strategyType,
    totalXAmount,
    totalYAmount,
    priceChanges,
    owner: wallet.publicKey,
    position: position.publicKey,
  });

  const { blockhash: recentBlockhash } =
    await dex.connection.getLatestBlockhash();

  createPositionInstructions = await sender.processJitoTipFromTxMessage(
    wallet.publicKey,
    createPositionInstructions,
    jitoConfig,
  );
  const createPositionV0Message = new TransactionMessage({
    recentBlockhash,
    payerKey: wallet.publicKey,
    instructions: createPositionInstructions,
  }).compileToV0Message();

  const createPositionV0Transaction = new VersionedTransaction(
    createPositionV0Message,
  );

  createPositionV0Transaction.sign([position]);
  const transactions = await wallet.signAllTransactions([
    ...swapV0Transactions,
    createPositionV0Transaction,
  ]);

  const bundleSimulationResponse = await sender.simulateBundle({
    transactions,
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

export const claimReward = async (
  dex: Dex,
  sender: SendTransaction,
  wallet: WalletAdapter,
  {
    pair,
    slippage,
    jitoConfig,
    position: positionPubkey,
  }: Exclude<
    z.infer<typeof meteoraClaimRewardSchema>,
    { transactions: string[] }
  >,
) => {
  const pool = await DLMM.create(dex.connection, pair);
  const position = await pool.getPosition(positionPubkey);
  const claimRewardTransactions = await dex.dlmm.meteora.buildClaimReward({
    pool,
    position,
    owner: wallet.publicKey,
  });

  const { blockhash: recentBlockhash } =
    await dex.connection.getLatestBlockhash();
  const claimRewardV0Transactions = await Promise.all(
    claimRewardTransactions.map(async (transaction, index) => {
      if (index === 0)
        transaction = await sender.processJitoTipFromTxMessage(
          wallet.publicKey,
          transaction,
          jitoConfig,
        );
      const v0Message = new TransactionMessage({
        recentBlockhash,
        payerKey: wallet.publicKey,
        instructions: transaction.instructions,
      }).compileToV0Message();

      return new VersionedTransaction(v0Message);
    }),
  );

  const tokenAAta = getAssociatedTokenAddressSync(
    pool.tokenX.mint.address,
    wallet.publicKey,
    false,
    pool.tokenX.owner,
  );
  const tokenBAta = getAssociatedTokenAddressSync(
    pool.tokenY.mint.address,
    wallet.publicKey,
    false,
    pool.tokenY.owner,
  );

  const accountConfigs = claimRewardTransactions.map(() => ({
    encoding: "base64" as const,
    addresses: [tokenAAta.toBase58(), tokenBAta.toBase58()],
  }));

  const simulationResponse = await sender.simulateBundle({
    transactions: claimRewardV0Transactions,
    skipSigVerify: false,
    preExecutionAccountsConfigs: accountConfigs,
    postExecutionAccountsConfigs: accountConfigs,
  });

  throwBundleSimulationError(simulationResponse.result.value);

  const tokenBalanceChanges = getTokenBalanceChangesFromBundleSimulation(
    simulationResponse.result.value,
  );

  const swapV0Transactions = [];
  const tokenConfigs: [PublicKey, number][] = [
    [pool.tokenX.mint.address, pool.tokenX.mint.decimals],
    [pool.tokenY.mint.address, pool.tokenY.mint.decimals],
  ];

  for (const [mint] of tokenConfigs) {
    if (!isNative(mint)) {
      const quoteAmount = tokenBalanceChanges[mint.toBase58()] ?? BigInt(0);
      if (quoteAmount > BigInt(0)) {
        const { transaction } = await dex.swap.jupiter.buildSwap({
          slippage,
          inputMint: mint,
          skipSimulation: true,
          owner: wallet.publicKey,
          outputMint: NATIVE_MINT,
          amount: quoteAmount.toString(),
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
    pair,
    slippage,
    jitoConfig,
    swapToNative,
    position: positionPubkey,
  }: Exclude<
    z.infer<typeof meteoraClosePositionSchema>,
    { transactions: string[] }
  >,
) => {
  const pool = await DLMM.create(dex.connection, pair);
  const position = await pool.getPosition(positionPubkey);
  const closePositionTransactions = await dex.dlmm.meteora.buildClosePosition({
    pool,
    position,
    owner: wallet.publicKey,
  });

  const { blockhash: recentBlockhash } =
    await dex.connection.getLatestBlockhash();
  const closePositionV0Transactions = await Promise.all(
    closePositionTransactions.map(async (transaction, index) => {
      if (index === 0)
        transaction = await sender.processJitoTipFromTxMessage(
          wallet.publicKey,
          transaction,
          jitoConfig,
        );
      const v0Message = new TransactionMessage({
        recentBlockhash,
        payerKey: wallet.publicKey,
        instructions: transaction.instructions,
      }).compileToV0Message();

      return new VersionedTransaction(v0Message);
    }),
  );

  const swapV0Transactions = [];

  if (swapToNative) {
    const tokenAAta = getAssociatedTokenAddressSync(
      pool.tokenX.mint.address,
      wallet.publicKey,
      false,
      pool.tokenX.owner,
    );
    const tokenBAta = getAssociatedTokenAddressSync(
      pool.tokenY.mint.address,
      wallet.publicKey,
      false,
      pool.tokenY.owner,
    );

    const accountConfigs = closePositionTransactions.map(() => ({
      encoding: "base64" as const,
      addresses: [tokenAAta.toBase58(), tokenBAta.toBase58()],
    }));

    const simulationResponse = await sender.simulateBundle({
      skipSigVerify: true,
      replaceRecentBlockhash: true,
      transactions: closePositionV0Transactions,
      preExecutionAccountsConfigs: accountConfigs,
      postExecutionAccountsConfigs: accountConfigs,
    });

    throwBundleSimulationError(simulationResponse.result.value);

    const tokenBalanceChanges = getTokenBalanceChangesFromBundleSimulation(
      simulationResponse.result.value,
    );

    const tokenConfigs: [PublicKey, number][] = [
      [pool.tokenX.mint.address, pool.tokenX.mint.decimals],
      [pool.tokenY.mint.address, pool.tokenY.mint.decimals],
    ];

    for (const [mint] of tokenConfigs) {
      if (!isNative(mint)) {
        const quoteAmount = tokenBalanceChanges[mint.toBase58()] ?? BigInt(0);
        if (quoteAmount > BigInt(0)) {
          const { transaction } = await dex.swap.jupiter.buildSwap({
            slippage,
            inputMint: mint,
            skipSimulation: true,
            owner: wallet.publicKey,
            outputMint: NATIVE_MINT,
            amount: quoteAmount.toString(),
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
    transactions,
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
    z.infer<typeof meteoraRebalanceSchema>,
    { transactions: string[] }
  >,
) => {
  const pool = await DLMM.create(dex.connection, args.pool);
  const position = await pool.getPosition(args.position);
  const rebalanceTransactions = await dex.dlmm.meteora.buildRebalancePosition({
    pool,
    position,
    owner: wallet.publicKey,
    slippage: args.slippage,
    strategyType: StrategyType.Spot,
  });
  const { blockhash: recentBlockhash } =
    await dex.connection.getLatestBlockhash();
  const rebalanceV0Transactions = await Promise.all(
    rebalanceTransactions.map(async (transaction, index) => {
      if (index === 0)
        transaction = await sender.processJitoTipFromTxMessage(
          wallet.publicKey,
          transaction,
          args.jitoConfig,
        );
      const v0Message = new TransactionMessage({
        recentBlockhash,
        payerKey: wallet.publicKey,
        instructions: transaction.instructions,
      }).compileToV0Message();

      return new VersionedTransaction(v0Message);
    }),
  );

  const transactions = await wallet.signAllTransactions(
    rebalanceV0Transactions,
  );

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
