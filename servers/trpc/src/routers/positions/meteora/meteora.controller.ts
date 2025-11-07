import BN from "bn.js";
import Decimal from "decimal.js";
import type { z } from "zod/mini";
import DLMM, { StrategyType } from "@meteora-ag/dlmm";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import type {
  positionSelectSchema,
  settingsSelectSchema,
} from "@rhiva-ag/datasource";
import {
  getPreTokenBalanceForAccounts,
  getTokenBalanceChangesFromBatchSimulation,
} from "@rhiva-ag/dex/utils";
import {
  batchSimulateTransactions,
  isNative,
  type SendTransaction,
  type WalletAdapter,
} from "@rhiva-ag/shared";
import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import type { jitoTipConfigSchema } from "../position.schema";
import type {
  meteoraClaimRewardSchema,
  meteoraClosePositionSchema,
  meteoraCreatePositionSchema,
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
      const amount = inputAmount * ratio;
      const bigAmount = new BN(
        new Decimal(amount).mul(Math.pow(10, 9)).toFixed(0),
      );
      if (isNative(side)) {
        if (side.equals(tokenXMint)) {
          totalXAmount = bigAmount;
        } else if (side.equals(tokenYMint)) totalYAmount = bigAmount;
      } else {
        const { quote, transaction } = await dex.swap.jupiter.buildSwap({
          slippage,
          inputMint,
          outputMint: side,
          owner: wallet.publicKey,
          amount: BigInt(bigAmount.toString()),
        });

        if (side.equals(tokenXMint)) {
          const quoteAmount = quote[tokenXMint.toBase58()] ?? BigInt(0);
          if (quoteAmount > BigInt(0)) {
            totalXAmount = new BN(quoteAmount.toString());
            swapV0Transactions.push(transaction);
          }
        } else if (side.equals(tokenYMint)) {
          const quoteAmount = quote[tokenYMint.toBase58()] ?? BigInt(0);
          if (quoteAmount > BigInt(0)) {
            totalYAmount = new BN(quoteAmount.toString());
            swapV0Transactions.push(transaction);
          }
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

  createPositionInstructions = await sender.processJitoTipFromTxMessage(
    wallet.publicKey,
    createPositionInstructions,
    jitoConfig,
  );

  const { blockhash: recentBlockhash } =
    await dex.connection.getLatestBlockhash();

  const createPositionV0Message = new TransactionMessage({
    recentBlockhash,
    payerKey: wallet.publicKey,
    instructions: createPositionInstructions,
  }).compileToV0Message();

  const createPositionV0Transaction = new VersionedTransaction(
    createPositionV0Message,
  );

  const transactions = (
    await Promise.all([
      await wallet.signAllTransactions(swapV0Transactions),
      await wallet.signTransaction(createPositionV0Transaction, [position]),
    ])
  ).flat();
  const bundleSimulationResponse = await sender.simulateBundle({
    transactions,
    skipSigVerify: true,
    replaceRecentBlockhash: true,
  });

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

  const preTokenBalanceChanges = await getPreTokenBalanceForAccounts(
    dex.connection,
    [tokenAAta, tokenBAta],
  );

  const simulationResponses = await batchSimulateTransactions(dex.connection, {
    transactions: claimRewardV0Transactions,
    options: {
      sigVerify: false,
      accounts: {
        encoding: "base64",
        addresses: [tokenAAta.toBase58(), tokenBAta.toBase58()],
      },
    },
  });

  const errors = simulationResponses
    .filter((response) => response.err != null)
    .map((response) => response.err);
  if (errors.length > 0) throw errors;

  const tokenBalanceChanges = getTokenBalanceChangesFromBatchSimulation(
    simulationResponses,
    preTokenBalanceChanges,
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

    const preTokenBalanceChanges = await getPreTokenBalanceForAccounts(
      dex.connection,
      [tokenAAta, tokenBAta],
    );

    const simulationResponses = await batchSimulateTransactions(
      dex.connection,
      {
        transactions: closePositionV0Transactions,
        options: {
          sigVerify: false,
          accounts: {
            encoding: "base64",
            addresses: [tokenAAta.toBase58(), tokenBAta.toBase58()],
          },
        },
      },
    );

    const errors = simulationResponses
      .filter((response) => response.err != null)
      .map((response) => response.err);
    if (errors.length > 0) throw errors;

    const tokenBalanceChanges = getTokenBalanceChangesFromBatchSimulation(
      simulationResponses,
      preTokenBalanceChanges,
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

  const transactions = (
    await Promise.all([
      wallet.signAllTransactions(closePositionV0Transactions),
      wallet.signAllTransactions(swapV0Transactions),
    ])
  ).flat();
  const bundleSimulationResponse = await sender.simulateBundle({
    transactions,
    skipSigVerify: true,
    replaceRecentBlockhash: true,
  });

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

export const rebalancePosition = async ({
  dex,
  wallet,
  sender,
  settings,
  jitoConfig,
  position: offchainPosition,
}: {
  dex: Dex;
  wallet: WalletAdapter;
  sender: SendTransaction;
  jitoConfig: z.infer<typeof jitoTipConfigSchema>;
  position: z.infer<typeof positionSelectSchema>;
  settings: z.infer<typeof settingsSelectSchema>;
}) => {
  const pool = await DLMM.create(
    dex.connection,
    new PublicKey(offchainPosition.pool.id),
  );
  const position = await pool.getPosition(new PublicKey(offchainPosition.id));
  const rebalanceTransactions = await dex.dlmm.meteora.buildRebalancePosition({
    pool,
    position,
    owner: wallet.publicKey,
    slippage: settings.slippage,
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

  const transactions = await wallet.signAllTransactions(
    rebalanceV0Transactions,
  );

  const bundleSimulationResponse = await sender.simulateBundle({
    transactions,
    skipSigVerify: true,
    replaceRecentBlockhash: true,
  });

  return {
    transactions,
    bundleSimulationResponse,
    async execute() {
      const { result } = await sender.sendBundle(transactions);
      return result;
    },
  };
};
