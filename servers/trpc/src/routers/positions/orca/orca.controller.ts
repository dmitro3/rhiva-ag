import Decimal from "decimal.js";
import type { z } from "zod/mini";
import type Dex from "@rhiva-ag/dex";
import { tickIndexToPrice } from "@orca-so/whirlpools-core";
import { openPositionInstructions } from "@orca-so/whirlpools";
import { fetchPosition, fetchWhirlpool } from "@orca-so/whirlpools-client";
import { isNative, mapFilter, type SendTransaction } from "@rhiva-ag/shared";
import { fromLegacyPublicKey, fromVersionedTransaction } from "@solana/compat";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import {
  type Keypair,
  PublicKey,
  type VersionedTransaction,
} from "@solana/web3.js";
import type {
  positionSelectSchema,
  settingsSelectSchema,
} from "@rhiva-ag/datasource";
import {
  getPreTokenBalanceForAccounts,
  getTokenBalanceChangesFromSimulation,
} from "@rhiva-ag/dex";
import {
  pipe,
  address,
  createTransactionMessage,
  createKeyPairSignerFromBytes,
  setTransactionMessageFeePayer,
  getBase64EncodedWireTransaction,
  signTransactionMessageWithSigners,
  appendTransactionMessageInstructions,
  setTransactionMessageLifetimeUsingBlockhash,
  type Transaction,
  type RpcSimulateTransactionResult,
} from "@solana/kit";

import type {
  orcaClaimRewardSchema,
  orcaClosePositionSchema,
  orcaCreatePositionSchema,
} from "./orca.schema";

export const createPosition = async (
  dex: Dex,
  sender: SendTransaction,
  owner: Keypair,
  args: Exclude<
    z.infer<typeof orcaCreatePositionSchema>,
    { transactions: string[] }
  >,
) => {
  const signer = await createKeyPairSignerFromBytes(owner.secretKey);
  const { pair, inputAmount, inputMint, slippage, jitoConfig } = args;

  const pool = await fetchWhirlpool(dex.dlmm.rpc, pair);

  let tokenA = BigInt(0),
    tokenB = BigInt(0);

  const swapLegacyV0Transactions: VersionedTransaction[] = [];
  const tokenXMint = pool.data.tokenMintA,
    tokenYMint = pool.data.tokenMintB;

  const poolToken = [pool.data.tokenMintA, pool.data.tokenMintB];

  if (isNative(inputMint)) {
    for (const token of poolToken) {
      const amount = inputAmount / 2;
      const bigAmount = BigInt(
        new Decimal(amount).mul(Math.pow(10, 9)).toFixed(0),
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
          owner: owner.publicKey,
          outputMint: new PublicKey(token),
        });

        if (token === tokenXMint) {
          const quoteAmount = quote[tokenXMint] ?? BigInt(0);
          if (quoteAmount > BigInt(0)) {
            tokenA = quoteAmount;
            swapLegacyV0Transactions.push(transaction);
          }
        } else if (token === tokenYMint) {
          const quoteAmount = quote[tokenYMint] ?? BigInt(0);
          if (quoteAmount > BigInt(0)) {
            tokenB = quoteAmount;
            swapLegacyV0Transactions.push(transaction);
          }
        }
      }
    }
  } else throw new Error("unsupported input mint");

  const { instructions } = await dex.dlmm.orca.buildCreatePosition({
    ...args,
    tokenA,
    tokenB,
    pool,
    slippage,
    owner: signer,
  });

  const { value: recentBlockhash } = await dex.dlmm.rpc
    .getLatestBlockhash()
    .send();

  const createPositionV0Message = await pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(signer.address, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(recentBlockhash, tx),
    async (tx) =>
      appendTransactionMessageInstructions(
        [
          await sender.processJitoTipFromTxMessage(signer, jitoConfig),
          ...instructions,
        ],
        tx,
      ),
  );

  const swapV0Transactions = mapFilter(
    swapLegacyV0Transactions,
    (swapLegacyV0Transaction) => {
      swapLegacyV0Transaction.sign([owner]);
      return fromVersionedTransaction(swapLegacyV0Transaction);
    },
  );

  const createPositionV0Transaction: Transaction =
    await signTransactionMessageWithSigners(createPositionV0Message);

  const transactions = [...swapV0Transactions, createPositionV0Transaction];

  const bundleSimulationResponse = await sender.simulateBundle({
    skipSigVerify: true,
    replaceRecentBlockhash: true,
    transactions: transactions.map(getBase64EncodedWireTransaction),
  });

  return {
    transactions,
    bundleSimulationResponse,
    async execute() {
      const { result } = await sender.sendBundle(
        transactions.map(getBase64EncodedWireTransaction),
      );
      return result;
    },
  };
};

export const claimReward = async (
  dex: Dex,
  sender: SendTransaction,
  owner: Keypair,
  {
    pair,
    tokenA,
    tokenB,
    position,
    slippage,
    jitoConfig,
  }: Exclude<z.infer<typeof orcaClaimRewardSchema>, { transactions: string[] }>,
) => {
  const signer = await createKeyPairSignerFromBytes(owner.secretKey);
  const pool = await fetchWhirlpool(dex.dlmm.rpc, pair);
  const { instructions } = await dex.dlmm.orca.buildClaimReward({
    position,
    owner: signer,
  });

  const { value: recentBlockhash } = await dex.dlmm.rpc
    .getLatestBlockhash()
    .send();

  const claimRewardV0Message = await pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(signer.address, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(recentBlockhash, tx),
    async (tx) =>
      appendTransactionMessageInstructions(
        [
          await sender.processJitoTipFromTxMessage(signer, jitoConfig),
          ...instructions,
        ],
        tx,
      ),
  );

  const tokenAAta = getAssociatedTokenAddressSync(
    new PublicKey(pool.data.tokenMintA),
    owner.publicKey,
    false,
    new PublicKey(tokenA.owner),
  );
  const tokenBAta = getAssociatedTokenAddressSync(
    new PublicKey(pool.data.tokenMintB),
    owner.publicKey,
    false,
    new PublicKey(tokenB.owner),
  );

  const claimRewardV0Transaction: Transaction =
    await signTransactionMessageWithSigners(claimRewardV0Message);

  const preTokenBalanceChanges = await getPreTokenBalanceForAccounts(
    dex.connection,
    [tokenAAta, tokenBAta],
  );

  const simulationResponse = await dex.dlmm.rpc
    .simulateTransaction(
      getBase64EncodedWireTransaction(claimRewardV0Transaction),
      {
        encoding: "base64",
        sigVerify: false,
        replaceRecentBlockhash: true,
        accounts: {
          addresses: [
            fromLegacyPublicKey(tokenAAta),
            fromLegacyPublicKey(tokenBAta),
          ],
          encoding: "base64",
        },
      },
    )
    .send();

  if (simulationResponse.value.err) throw simulationResponse.value.err;

  const tokenBalanceChanges = getTokenBalanceChangesFromSimulation(
    simulationResponse.value as unknown as RpcSimulateTransactionResult,
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
          owner: owner.publicKey,
          outputMint: NATIVE_MINT,
          amount: quoteAmount.toString(),
          inputMint: new PublicKey(token.mint),
        });

        transaction.sign([owner]);

        swapV0Transactions.push(fromVersionedTransaction(transaction));
      }
    }
  }

  const transactions = [claimRewardV0Transaction, ...swapV0Transactions];

  const bundleSimulationResponse = await sender.simulateBundle({
    skipSigVerify: true,
    replaceRecentBlockhash: true,
    transactions: transactions.map(getBase64EncodedWireTransaction),
  });

  return {
    transactions,
    bundleSimulationResponse,
    async execute() {
      const { result } = await sender.sendBundle(
        transactions.map(getBase64EncodedWireTransaction),
      );
      return result;
    },
  };
};

export const closePosition = async (
  dex: Dex,
  sender: SendTransaction,
  owner: Keypair,
  {
    slippage,
    position,
    pair,
    tokenA,
    tokenB,
    jitoConfig,
    swapToNative,
  }: Exclude<
    z.infer<typeof orcaClosePositionSchema>,
    { transactions: string[] }
  >,
) => {
  const pool = await fetchWhirlpool(dex.dlmm.rpc, pair);
  const signer = await createKeyPairSignerFromBytes(owner.secretKey);
  const { instructions } = await dex.dlmm.orca.buildClosePosition({
    position,
    slippage,
    owner: signer,
  });

  const { value: recentBlockhash } = await dex.dlmm.rpc
    .getLatestBlockhash()
    .send();

  const closePositionV0Message = await pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(signer.address, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(recentBlockhash, tx),
    async (tx) =>
      appendTransactionMessageInstructions(
        [
          await sender.processJitoTipFromTxMessage(signer, jitoConfig),
          ...instructions,
        ],
        tx,
      ),
  );
  const swapV0Transactions = [];

  const closePositionV0Transaction: Transaction =
    await signTransactionMessageWithSigners(closePositionV0Message);

  if (swapToNative) {
    const tokenAAta = getAssociatedTokenAddressSync(
      new PublicKey(pool.data.tokenMintA),
      owner.publicKey,
      false,
      new PublicKey(tokenA.owner),
    );
    const tokenBAta = getAssociatedTokenAddressSync(
      new PublicKey(pool.data.tokenMintB),
      owner.publicKey,
      false,
      new PublicKey(tokenB.owner),
    );
    const preTokenBalanceChanges = await getPreTokenBalanceForAccounts(
      dex.connection,
      [tokenAAta, tokenBAta],
    );

    const simulationResponse = await dex.dlmm.rpc
      .simulateTransaction(
        getBase64EncodedWireTransaction(closePositionV0Transaction),
        {
          encoding: "base64",
          sigVerify: false,
          replaceRecentBlockhash: true,
          accounts: {
            addresses: [
              fromLegacyPublicKey(tokenAAta),
              fromLegacyPublicKey(tokenBAta),
            ],
            encoding: "base64",
          },
        },
      )
      .send();

    if (simulationResponse.value.err) throw simulationResponse.value.err;

    const tokenBalanceChanges = getTokenBalanceChangesFromSimulation(
      simulationResponse.value as unknown as RpcSimulateTransactionResult,
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
            owner: owner.publicKey,
            outputMint: NATIVE_MINT,
            amount: quoteAmount.toString(),
            inputMint: new PublicKey(token.mint),
          });

          transaction.sign([owner]);

          swapV0Transactions.push(fromVersionedTransaction(transaction));
        }
      }
    }
  }

  const transactions = [closePositionV0Transaction, ...swapV0Transactions];

  const bundleSimulationResponse = await sender.simulateBundle({
    skipSigVerify: true,
    replaceRecentBlockhash: true,
    transactions: transactions.map(getBase64EncodedWireTransaction),
  });

  return {
    pool,
    transactions,
    swapV0Transactions,
    closePositionV0Transaction,
    bundleSimulationResponse,
    async execute() {
      const { result } = await sender.sendBundle(
        transactions.map(getBase64EncodedWireTransaction),
      );
      return result;
    },
  };
};

export const rebalancePosition = async ({
  dex,
  owner,
  sender,
  settings,
  position: offchainPosition,
}: {
  dex: Dex;
  owner: Keypair;
  sender: SendTransaction;
  position: z.infer<typeof positionSelectSchema>;
  settings: z.infer<typeof settingsSelectSchema>;
}) => {
  const signer = await createKeyPairSignerFromBytes(owner.secretKey);
  const position = await fetchPosition(
    dex.dlmm.rpc,
    address(offchainPosition.id),
  );

  const { pool, swapV0Transactions, closePositionV0Transaction } =
    await closePosition(dex, sender, owner, {
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
  const transactions = [closePositionV0Transaction, ...swapV0Transactions];

  const tokenAAta = getAssociatedTokenAddressSync(
    new PublicKey(offchainPosition.pool.baseToken.id),
    owner.publicKey,
    false,
    new PublicKey(offchainPosition.pool.baseToken.tokenProgram),
  );
  const tokenBAta = getAssociatedTokenAddressSync(
    new PublicKey(offchainPosition.pool.quoteToken.id),
    owner.publicKey,
    false,
    new PublicKey(offchainPosition.pool.quoteToken.tokenProgram),
  );

  const preTokenBalanceChanges = await getPreTokenBalanceForAccounts(
    dex.connection,
    [
      isNative(offchainPosition.pool.baseToken.id)
        ? owner.publicKey
        : tokenAAta,
      isNative(offchainPosition.pool.quoteToken.id)
        ? owner.publicKey
        : tokenBAta,
    ],
  );

  const simulationResponse = await dex.dlmm.rpc
    .simulateTransaction(
      getBase64EncodedWireTransaction(closePositionV0Transaction),
      {
        encoding: "base64",
        sigVerify: false,
        replaceRecentBlockhash: true,
        accounts: {
          addresses: [
            fromLegacyPublicKey(tokenAAta),
            fromLegacyPublicKey(tokenBAta),
          ],
          encoding: "base64",
        },
      },
    )
    .send();

  const tokenBalanceChanges = getTokenBalanceChangesFromSimulation(
    simulationResponse.value as unknown as RpcSimulateTransactionResult,
    preTokenBalanceChanges,
  );
  const tokenA =
    tokenBalanceChanges[offchainPosition.pool.baseToken.id] || BigInt(0);
  const tokenB =
    tokenBalanceChanges[offchainPosition.pool.quoteToken.id] || BigInt(0);

  const tickDelta = Math.ceil(
    Math.abs(position.data.tickUpperIndex - position.data.tickLowerIndex),
  );
  const lowerPrice = tickIndexToPrice(
    pool.data.tickCurrentIndex - tickDelta,
    offchainPosition.pool.baseToken.decimals,
    offchainPosition.pool.quoteToken.decimals,
  );
  const upperPrice = tickIndexToPrice(
    pool.data.tickCurrentIndex + tickDelta,
    offchainPosition.pool.baseToken.decimals,
    offchainPosition.pool.quoteToken.decimals,
  );

  const { instructions } = await openPositionInstructions(
    dex.dlmm.rpc,
    address(offchainPosition.pool.id),
    { tokenA, tokenB },
    lowerPrice,
    upperPrice,
    settings.slippage,
    signer,
  );

  const { value: recentBlockhash } = await dex.dlmm.rpc
    .getLatestBlockhash()
    .send();

  const createPositionV0Message = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) =>
      setTransactionMessageFeePayer(fromLegacyPublicKey(owner.publicKey), tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(recentBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
  );

  const transaction: Transaction = await signTransactionMessageWithSigners(
    createPositionV0Message,
  );
  transactions.push(transaction);

  const bundleSimulationResponse = await sender.simulateBundle({
    skipSigVerify: true,
    replaceRecentBlockhash: true,
    transactions: transactions.map(getBase64EncodedWireTransaction),
  });

  return {
    transactions,
    bundleSimulationResponse,
    async execute() {
      const { result } = await sender.sendBundle(
        transactions.map(getBase64EncodedWireTransaction),
      );
      return result;
    },
  };
};
