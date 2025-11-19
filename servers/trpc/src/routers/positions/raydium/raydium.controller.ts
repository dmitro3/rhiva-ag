import { BN } from "bn.js";
import assert from "assert";
import Decimal from "decimal.js";
import type { z } from "zod/mini";
import { PublicKey, type VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import type {
  positionSelectSchema,
  settingsSelectSchema,
} from "@rhiva-ag/datasource";
import {
  isNative,
  throwBundleSimulationError,
  throwSimulationError,
  type SendTransaction,
  type WalletAdapter,
} from "@rhiva-ag/shared";
import {
  getPreTokenBalanceForAccounts,
  getTokenBalanceChangesFromBundleSimulation,
  getTokenBalanceChangesFromSimulation,
} from "@rhiva-ag/dex/utils";
import {
  TickUtils,
  TxVersion,
  PoolUtils,
  CLMM_PROGRAM_ID,
  PositionInfoLayout,
  getPdaPersonalPositionAddress,
  type ApiV3PoolInfoConcentratedItem,
  type ReturnTypeGetLiquidityAmountOut,
} from "@raydium-io/raydium-sdk-v2";

import type {
  raydiumClaimRewardSchema,
  raydiumClosePositionSchema,
  raydiumCreatePositionSchema,
} from "./raydium.schema";

type Dex =
  | import("@rhiva-ag/dex").default
  | import("@rhiva-ag/dex/browser").default;

export const createPosition = async (
  dex: Dex,
  sender: SendTransaction,
  wallet: WalletAdapter,
  {
    pair,
    slippage,
    inputMint,
    jitoConfig,
    inputAmount,
    priceChanges,
  }: Exclude<
    z.infer<typeof raydiumCreatePositionSchema>,
    { transactions: string[] }
  >,
) => {
  const pool = await dex.clmm.raydium.raydium.clmm.getPoolInfoFromRpc(
    pair.toBase58(),
  );
  const { poolInfo } = pool;
  const currentPrice = poolInfo.price;
  const swapV0Transactions: VersionedTransaction[] = [];

  let addLiquidityAmount = BigInt(0);
  const addLiquidityMint = isNative(poolInfo.mintA.address)
    ? poolInfo.mintA.address
    : isNative(poolInfo.mintB.address)
      ? poolInfo.mintB.address
      : poolInfo.mintA.address;
  const baseIn = poolInfo.mintA.address === addLiquidityMint;

  const ticks = priceChanges.map(
    (priceChange) =>
      TickUtils.getPriceAndTick({
        baseIn,
        poolInfo,
        price: new Decimal(currentPrice + currentPrice * priceChange),
      }).tick,
  );

  const tickLower = Math.min(...ticks);
  const tickUpper = Math.max(...ticks);

  let quote: ReturnTypeGetLiquidityAmountOut;
  const epochInfo = await dex.clmm.raydium.raydium.fetchEpochInfo();

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
        outputMint: poolInfo.mintA.address,
      });

      addLiquidityAmount = BigInt(quoteResponse.inAmount);
      swapV0Transactions.push(transaction);
    }

    quote = await PoolUtils.getLiquidityAmountOutFromAmountIn({
      slippage,
      epochInfo,
      tickLower,
      tickUpper,
      add: false,
      amountHasFee: true,
      poolInfo: pool.poolInfo,
      amount: new BN(addLiquidityAmount),
      inputA: addLiquidityMint === poolInfo.mintA.address,
    });

    const quoteResponse = await dex.swap.jupiter.jupiter.quoteGet({
      outputMint: NATIVE_MINT.toBase58(),
      inputMint: baseIn ? poolInfo.mintB.address : poolInfo.mintA.address,
      //@ts-expect-error
      amount: baseIn
        ? quote.amountB.amount.toString()
        : quote.amountA.amount.toString(),
    });

    const { transaction } = await dex.swap.jupiter.buildSwap({
      inputMint,
      slippage,
      skipSimulation: true,
      owner: wallet.publicKey,
      amount: quoteResponse.outAmount,
      outputMint: baseIn ? poolInfo.mintB.address : poolInfo.mintA.address,
    });

    swapV0Transactions.push(transaction);
  } else throw new Error("unsupported input mint");

  const { signers, builder, extInfo } =
    await dex.clmm.raydium.buildCreatePosition({
      quote,
      slippage,
      pool,
      tickUpper,
      tickLower,
      inputMint: addLiquidityMint,
    });

  const jitoTipInstruction = await sender.getJitoTipInstruction(
    wallet.publicKey,
    jitoConfig,
  );

  if (jitoTipInstruction)
    builder.addInstruction({ instructions: [jitoTipInstruction] });

  const { transaction: createPositionV0Transaction } = await builder.buildV0();
  createPositionV0Transaction.sign(signers);

  const transactions = await wallet.signAllTransactions([
    ...swapV0Transactions,
    createPositionV0Transaction,
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
    positionNftMint: extInfo.nftMint,
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
    position: positionPubkey,
    pair,
    slippage,
    jitoConfig,
  }: Exclude<
    z.infer<typeof raydiumClaimRewardSchema>,
    { transactions: string[] }
  >,
) => {
  const accountInfo = await dex.connection.getAccountInfo(
    getPdaPersonalPositionAddress(CLMM_PROGRAM_ID, positionPubkey).publicKey,
  );
  assert(accountInfo, "position not found.");

  const position = PositionInfoLayout.decode(accountInfo.data);
  const [poolInfo] = await dex.clmm.raydium.raydium.api.fetchPoolById({
    ids: pair.toBase58(),
  });

  assert(poolInfo, "pool not found.");

  const { builder } = await dex.clmm.raydium.buildClaimReward({
    position,
    poolInfo: poolInfo as ApiV3PoolInfoConcentratedItem,
  });
  const jitoTipInstruction = await sender.getJitoTipInstruction(
    wallet.publicKey,
    jitoConfig,
  );

  if (jitoTipInstruction)
    builder.addInstruction({ instructions: [jitoTipInstruction] });

  const { transactions: claimRewardV0Transactions } =
    await builder.buildV0MultiTx({});

  const tokenAAta = getAssociatedTokenAddressSync(
    new PublicKey(poolInfo.mintA.address),
    wallet.publicKey,
    false,
    new PublicKey(poolInfo.mintA.programId),
  );
  const tokenBAta = getAssociatedTokenAddressSync(
    new PublicKey(poolInfo.mintB.address),
    wallet.publicKey,
    false,
    new PublicKey(poolInfo.mintB.programId),
  );

  const accountConfigs = claimRewardV0Transactions.map(() => ({
    encoding: "base64" as const,
    addresses: [tokenAAta.toBase58(), tokenBAta.toBase58()],
  }));
  const simulationResponse = await sender.simulateBundle({
    skipSigVerify: false,
    replaceRecentBlockhash: true,
    transactions: claimRewardV0Transactions,
    preExecutionAccountsConfigs: accountConfigs,
    postExecutionAccountsConfigs: accountConfigs,
  });

  throwBundleSimulationError(simulationResponse.result.value);

  const tokenBalanceChanges = getTokenBalanceChangesFromBundleSimulation(
    simulationResponse.result.value,
  );

  const swapV0Transactions = [];
  const tokens = [poolInfo.mintA, poolInfo.mintB];

  for (const token of tokens) {
    if (!isNative(token.address)) {
      const quoteAmount = tokenBalanceChanges[token.address] ?? BigInt(0);
      if (quoteAmount > BigInt(0)) {
        const { transaction } = await dex.swap.jupiter.buildSwap({
          slippage,
          skipSimulation: true,
          owner: wallet.publicKey,
          outputMint: NATIVE_MINT,
          amount: quoteAmount.toString(),
          inputMint: new PublicKey(token.address),
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
    swapV0Transactions,
    bundleSimulationResponse,
    async execute() {
      const { result } = await sender.sendBundle(transactions);
      return result;
    },
  };
};

export const closePosition = async (
  dex: Dex,
  wallet: WalletAdapter,
  sender: SendTransaction,
  {
    pair,
    slippage,
    jitoConfig,
    swapToNative,
    position: positionPubkey,
  }: Exclude<
    z.infer<typeof raydiumClosePositionSchema>,
    { transactions: string[] }
  >,
) => {
  const accountInfo = await dex.connection.getAccountInfo(
    getPdaPersonalPositionAddress(CLMM_PROGRAM_ID, positionPubkey).publicKey,
  );
  assert(accountInfo, "position not found.");

  const position = PositionInfoLayout.decode(accountInfo.data);
  const [poolInfo] = (await dex.clmm.raydium.raydium.api.fetchPoolById({
    ids: pair.toBase58(),
  })) as ApiV3PoolInfoConcentratedItem[];

  assert(poolInfo, "pool not found.");

  const { builder } = await dex.clmm.raydium.buildClosePosition({
    position,
    poolInfo: poolInfo as ApiV3PoolInfoConcentratedItem,
  });
  const jitoTipInstruction = await sender.getJitoTipInstruction(
    wallet.publicKey,
    jitoConfig,
  );

  if (jitoTipInstruction)
    builder.addInstruction({ instructions: [jitoTipInstruction] });

  const { transaction: closePositionV0Transaction } = await builder.buildV0();

  const swapV0Transactions = [];
  let nativeAmount = new BN(0);
  let tokenBalanceChanges: Record<string, bigint> = {};

  if (swapToNative) {
    const tokenAAta = getAssociatedTokenAddressSync(
      new PublicKey(poolInfo.mintA.address),
      wallet.publicKey,
      false,
      new PublicKey(poolInfo.mintA.programId),
    );
    const tokenBAta = getAssociatedTokenAddressSync(
      new PublicKey(poolInfo.mintB.address),
      wallet.publicKey,
      false,
      new PublicKey(poolInfo.mintB.programId),
    );

    const preTokenBalanceChanges = await getPreTokenBalanceForAccounts(
      dex.connection,
      [tokenAAta, tokenBAta],
    );

    const simulationResponse = await dex.connection.simulateTransaction(
      closePositionV0Transaction,
      {
        sigVerify: false,
        replaceRecentBlockhash: true,
        accounts: {
          addresses: [tokenAAta.toBase58(), tokenBAta.toBase58()],
          encoding: "base64",
        },
      },
    );

    throwSimulationError(simulationResponse.value);

    tokenBalanceChanges = getTokenBalanceChangesFromSimulation(
      simulationResponse.value,
      preTokenBalanceChanges,
    );

    const tokens = [poolInfo.mintA, poolInfo.mintB];

    for (const token of tokens) {
      if (!isNative(token.address)) {
        const quoteAmount = tokenBalanceChanges[token.address] ?? BigInt(0);
        if (quoteAmount > BigInt(0)) {
          const { transaction, quoteResponse } =
            await dex.swap.jupiter.buildSwap({
              slippage,
              skipSimulation: true,
              owner: wallet.publicKey,
              outputMint: NATIVE_MINT,
              amount: quoteAmount.toString(),
              inputMint: new PublicKey(token.address),
            });
          nativeAmount = nativeAmount.add(new BN(quoteResponse.outAmount));
          if (quoteResponse.platformFee?.amount)
            nativeAmount = nativeAmount.sub(
              new BN(quoteResponse.platformFee.amount),
            );

          swapV0Transactions.push(transaction);
        }
      }
    }
  }

  const transactions = await wallet.signAllTransactions([
    closePositionV0Transaction,
    ...swapV0Transactions,
  ]);

  const bundleSimulationResponse = await sender.simulateBundle({
    transactions,
    skipSigVerify: true,
    replaceRecentBlockhash: true,
  });

  throwBundleSimulationError(bundleSimulationResponse.result.value);

  return {
    position,
    poolInfo,
    transactions,
    nativeAmount,
    tokenBalanceChanges,
    closePositionV0Transaction,
    swapV0Transactions,
    bundleSimulationResponse,
    async execute() {
      const { result } = await sender.sendBundle(transactions);
      return result;
    },
  };
};

export const rebalancePosition = async ({
  dex,
  sender,
  wallet,
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
    poolInfo,
    swapV0Transactions,
    closePositionV0Transaction,
    position,
    tokenBalanceChanges,
  } = await closePosition(dex, wallet, sender, {
    position: new PublicKey(offchainPosition.id),
    pair: new PublicKey(offchainPosition.pool.id),
    slippage: settings.slippage,
    jitoConfig: { type: "dynamic", priorityFeePercentile: "75" },
  });
  const transactions = [closePositionV0Transaction, ...swapV0Transactions];

  const amountMaxA = new BN(
    tokenBalanceChanges[poolInfo.mintA.address] || BigInt(0),
  );
  const amountMaxB = new BN(
    tokenBalanceChanges[poolInfo.mintB.address] || BigInt(0),
  );
  const rpcData = await dex.clmm.raydium.raydium.clmm.getRpcClmmPoolInfo({
    poolId: poolInfo.id,
  });
  poolInfo.price = rpcData.currentPrice;
  const { tick: currentTick } = TickUtils.getPriceAndTick({
    poolInfo,
    baseIn: true,
    price: new Decimal(poolInfo.price),
  });
  const tickDelta = Math.ceil(
    Math.abs(position.tickUpper - position.tickLower),
  );
  const tickUpper = currentTick - tickDelta;
  const tickLower = currentTick + tickDelta;

  const { transaction, signers, extInfo } =
    await dex.clmm.raydium.raydium.clmm.openPositionFromBase({
      poolInfo,
      tickLower,
      tickUpper,
      base: "MintA",
      baseAmount: amountMaxA,
      otherAmountMax: amountMaxB,
      ownerInfo: {
        useSOLBalance: true,
      },
      txVersion: TxVersion.V0,
    });

  transactions.push(await wallet.signTransaction(transaction, signers));

  const bundleSimulationResponse = await sender.simulateBundle({
    transactions,
    skipSigVerify: true,
  });

  throwBundleSimulationError(bundleSimulationResponse.result.value);

  return {
    transactions,
    bundleSimulationResponse,
    positionNftMint: extInfo.nftMint,
    async execute() {
      const { result } = await sender.sendBundle(transactions);
      return result;
    },
  };
};
