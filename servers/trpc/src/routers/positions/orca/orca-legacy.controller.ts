import Decimal from "decimal.js";
import type { z } from "zod/mini";
import { address } from "@solana/kit";
import { TickUtil } from "@orca-so/whirlpools-sdk";
import { fetchWhirlpool } from "@orca-so/whirlpools-client";
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
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

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

  let tokenA = BigInt(0),
    tokenB = BigInt(0);

  const swapV0Transactions: VersionedTransaction[] = [];
  const tokenXMint = poolData.tokenMintA,
    tokenYMint = poolData.tokenMintB;

  const poolToken = [tokenXMint, tokenYMint];

  if (isNative(inputMint)) {
    for (const token of poolToken) {
      const amount = inputAmount / 2;
      const bigAmount = BigInt(
        new Decimal(amount).mul(Math.pow(10, 9)).toFixed(),
      );

      if (isNative(token)) {
        if (token === tokenXMint) {
          tokenA = bigAmount;
        } else if (token === tokenYMint) tokenB = bigAmount;
      } else {
        const { quote, transaction } = await dex.swap.jupiter.buildSwap({
          slippage,
          inputMint,
          amount: bigAmount,
          owner: wallet.publicKey,
          outputMint: new PublicKey(token),
        });

        if (token === tokenXMint) {
          const quoteAmount = quote[tokenXMint.toBase58()] ?? BigInt(0);
          if (quoteAmount > BigInt(0)) {
            tokenA = quoteAmount;
            swapV0Transactions.push(transaction);
          }
        } else if (token === tokenYMint) {
          const quoteAmount = quote[tokenYMint.toBase58()] ?? BigInt(0);
          if (quoteAmount > BigInt(0)) {
            tokenB = quoteAmount;
            swapV0Transactions.push(transaction);
          }
        }
      }
    }
  } else throw new Error("unsupported input mint");

  const { transactions: createPositionTransactions, positionMint } =
    await dex.dlmm.orcaLegacy.buildCreatePosition({
      ...args,
      pool,
      slippage,
      owner: wallet.publicKey,
      inputAmount: tokenA > BigInt(0) ? tokenA : tokenB,
      inputMint: new PublicKey(tokenA > BigInt(0) ? tokenXMint : tokenYMint),
    });

  const { blockhash: recentBlockhash } =
    await dex.connection.getLatestBlockhash();

  const createPositionV0Transactions = await Promise.all(
    createPositionTransactions.map(async (transaction, index) => {
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

  const transactions = await wallet.signAllTransactions([
    ...createPositionV0Transactions,
    ...swapV0Transactions,
  ]);

  const bundleSimulationResponse = await sender.simulateBundle({
    transactions,
    skipSigVerify: true,
    replaceRecentBlockhash: true,
  });

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
  const claimRewardTransactions = await dex.dlmm.orcaLegacy.buildClaimReward({
    position: new PublicKey(position),
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

  const closePositionTransactions =
    await dex.dlmm.orcaLegacy.buildClosePosition({
      pool,
      position,
      slippage,
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
    pool,
    position,
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
  position: offchainPosition,
}: {
  dex: Dex;
  wallet: WalletAdapter;
  sender: SendTransaction;
  position: z.infer<typeof positionSelectSchema>;
  settings: z.infer<typeof settingsSelectSchema>;
}) => {
  const { pool, position, swapV0Transactions, closePositionV0Transactions } =
    await closePosition(dex, sender, wallet, {
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
  const transactions = [...closePositionV0Transactions, ...swapV0Transactions];

  const tokenAAta = getAssociatedTokenAddressSync(
    new PublicKey(offchainPosition.pool.baseToken.id),
    wallet.publicKey,
    false,
    new PublicKey(offchainPosition.pool.baseToken.tokenProgram),
  );
  const tokenBAta = getAssociatedTokenAddressSync(
    new PublicKey(offchainPosition.pool.quoteToken.id),
    wallet.publicKey,
    false,
    new PublicKey(offchainPosition.pool.quoteToken.tokenProgram),
  );

  const preTokenBalanceChanges = await getPreTokenBalanceForAccounts(
    dex.connection,
    [
      isNative(offchainPosition.pool.baseToken.id)
        ? wallet.publicKey
        : tokenAAta,
      isNative(offchainPosition.pool.quoteToken.id)
        ? wallet.publicKey
        : tokenBAta,
    ],
  );

  const simulationResponses = await batchSimulateTransactions(dex.connection, {
    transactions: closePositionV0Transactions,
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

  const { transactions: createPositionTransactions, positionMint } =
    await dex.dlmm.orcaLegacy.buildPreloadedCreatePosition({
      pool,

      lowerTick,
      upperTick,
      owner: wallet.publicKey,
      slippage: settings.slippage,
      inputAmount: tokenA > BigInt(0) ? tokenA : tokenB,
      inputMint: tokenA > BigInt(0) ? poolData.tokenMintA : poolData.tokenMintB,
    });

  const { blockhash: recentBlockhash } =
    await dex.connection.getLatestBlockhash();
  const createPositionV0Transactions = await Promise.all(
    createPositionTransactions.map(async (transaction) => {
      const v0Message = new TransactionMessage({
        recentBlockhash,
        payerKey: wallet.publicKey,
        instructions: transaction.instructions,
      }).compileToV0Message();

      return new VersionedTransaction(v0Message);
    }),
  );

  transactions.push(
    ...(await wallet.signAllTransactions(createPositionV0Transactions)),
  );
  const bundleSimulationResponse = await sender.simulateBundle({
    transactions,
    skipSigVerify: true,
  });

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
