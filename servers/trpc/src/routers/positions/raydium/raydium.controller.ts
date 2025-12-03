import assert from "assert";
import { BN } from "bn.js";
import type { z } from "zod";
import Decimal from "decimal.js";
import { PublicKey, type VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import {
  PoolUtils,
  TxVersion,
  TickUtils,
  CLMM_PROGRAM_ID,
  PositionInfoLayout,
  getPdaPersonalPositionAddress,
  type ApiV3PoolInfoConcentratedItem,
  type ReturnTypeGetLiquidityAmountOut,
  type ApiV3PoolInfoItem,
} from "@raydium-io/raydium-sdk-v2";
import {
  isNative,
  percentageFromBps,
  throwBundleSimulationError,
  getTokenBalanceChangesFromBundleSimulation,
  type WalletAdapter,
  type SendTransaction,
} from "@rhiva-ag/shared";

import type {
  raydiumClaimRewardSchema,
  raydiumClosePositionSchema,
  raydiumCreatePositionSchema,
  raydiumRepositionSchema,
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
    skipSig,
    slippage,
    inputMint,
    jitoConfig,
    inputAmount,
    ...args
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

  const ticks =
    "tickRange" in args
      ? args.tickRange
      : args.priceChanges.map(
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
      epochInfo,
      tickLower,
      tickUpper,
      add: false,
      amountHasFee: true,
      poolInfo: pool.poolInfo,
      amount: new BN(addLiquidityAmount),
      slippage: percentageFromBps(slippage),

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
      pool,
      quote,
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

  const unsignedTransactions = [
    ...swapV0Transactions,
    createPositionV0Transaction,
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
    positionMint: extInfo.nftMint,
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
    swapToNative,
    ...args
  }: Exclude<
    z.infer<typeof raydiumClaimRewardSchema>,
    { transactions: string[] }
  > & { poolInfo?: ApiV3PoolInfoItem },
) => {
  const accountInfo = await dex.connection.getAccountInfo(
    getPdaPersonalPositionAddress(CLMM_PROGRAM_ID, args.position).publicKey,
  );
  assert(accountInfo, "position not found.");

  const position = PositionInfoLayout.decode(accountInfo.data);
  const [poolInfo] = args.poolInfo
    ? [args.poolInfo]
    : await dex.clmm.raydium.raydium.api.fetchPoolById({
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

  const swapV0Transactions = [];

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

    const accountConfigs = claimRewardV0Transactions.map(() => ({
      encoding: "base64" as const,
      addresses: [tokenAAta.toBase58(), tokenBAta.toBase58()],
    }));
    const simulationResponse = await sender.simulateBundle({
      skipSigVerify: true,
      replaceRecentBlockhash: true,
      transactions: claimRewardV0Transactions,
      preExecutionAccountsConfigs: accountConfigs,
      postExecutionAccountsConfigs: accountConfigs,
    });

    throwBundleSimulationError(simulationResponse.result.value);

    const tokenBalanceChanges = getTokenBalanceChangesFromBundleSimulation(
      simulationResponse.result.value,
    );

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

  const accountConfigs = [
    {
      encoding: "base64" as const,
      addresses: [
        wallet.publicKey.toBase58(),
        tokenAAta.toBase58(),
        tokenBAta.toBase58(),
      ],
    },
  ];

  if (swapToNative) {
    const simulationResponse = await sender.simulateBundle({
      skipSigVerify: true,
      transactions: [closePositionV0Transaction],
      postExecutionAccountsConfigs: accountConfigs,
      preExecutionAccountsConfigs: accountConfigs,
    });

    throwBundleSimulationError(simulationResponse.result.value);

    tokenBalanceChanges = getTokenBalanceChangesFromBundleSimulation(
      simulationResponse.result.value,
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

  const unsignedTransactions = [
    closePositionV0Transaction,
    ...swapV0Transactions,
  ];
  const transactions = skipSig
    ? unsignedTransactions
    : await wallet.signAllTransactions([
        closePositionV0Transaction,
        ...swapV0Transactions,
      ]);

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
    tokenAAta,
    tokenBAta,
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

export const reposition = async (
  dex: Dex,
  sender: SendTransaction,
  wallet: WalletAdapter,
  args: Exclude<
    z.infer<typeof raydiumRepositionSchema>,
    { transactions: string[] }
  >,
) => {
  const swapToNative = args.type === "swap";

  let positionMint: PublicKey;
  let transactions: VersionedTransaction[];

  const {
    poolInfo,
    position,
    tokenBAta,
    swapV0Transactions,
    tokenBalanceChanges,
    closePositionV0Transaction,
  } = await closePosition(dex, sender, wallet, {
    swapToNative,
    skipSig: true,
    pair: args.pair,
    slippage: args.slippage,
    position: args.position,
    jitoConfig: args.jitoConfig,
  });
  const rpcData = await dex.clmm.raydium.raydium.clmm.getRpcClmmPoolInfo({
    poolId: poolInfo.id,
  });
  poolInfo.price = rpcData.currentPrice;
  const currentPrice = new Decimal(poolInfo.price);
  const { price: lowerPrice } = TickUtils.getTickPrice({
    poolInfo,
    baseIn: true,
    tick: position.tickLower,
  });
  const { price: upperPrice } = TickUtils.getTickPrice({
    poolInfo,
    baseIn: true,
    tick: position.tickUpper,
  });

  const priceDelta = upperPrice.sub(lowerPrice).div(2);
  const currentLowerPrice = currentPrice.sub(priceDelta);
  const currentUpperPrice = currentPrice.add(priceDelta);

  const ticks = [
    TickUtils.getPriceAndTick({
      poolInfo,
      baseIn: true,
      price: currentLowerPrice,
    }).tick,
    TickUtils.getPriceAndTick({
      poolInfo,
      baseIn: true,
      price: currentUpperPrice,
    }).tick,
  ];
  const tickLower = Math.min(...ticks);
  const tickUpper = Math.max(...ticks);

  if (swapToNative) {
    const rawInputAmount = tokenBalanceChanges[NATIVE_MINT.toBase58()];
    assert(
      rawInputAmount && rawInputAmount > BigInt(0),
      "expected amount to be greater than 0",
    );
    const inputAmount = new Decimal(rawInputAmount)
      .div(Math.pow(10, 9))
      .toNumber();
    const response = await createPosition(dex, sender, wallet, {
      inputAmount,
      skipSig: true,
      pair: args.pair,
      inputMint: NATIVE_MINT,
      slippage: args.slippage,
      jitoConfig: args.jitoConfig,
      tickRange: [tickLower, tickUpper],
    });

    positionMint = response.positionMint;
    transactions = [
      closePositionV0Transaction,
      ...swapV0Transactions,
      ...response.transactions,
    ];
  } else {
    const rawAmountA = tokenBalanceChanges[poolInfo.mintA.address];
    const rawAmountB = tokenBalanceChanges[poolInfo.mintB.address];
    assert(rawAmountA && rawAmountB, "expected not to be undefined");
    const amountMaxA = new BN(rawAmountA);
    const amountMaxB = new BN(rawAmountB);

    const epochInfo = await dex.clmm.raydium.raydium.fetchEpochInfo();
    const quote = await PoolUtils.getLiquidityAmountOutFromAmountIn({
      poolInfo,
      epochInfo,
      tickLower,
      tickUpper,
      add: true,
      inputA: true,
      amountHasFee: true,
      amount: amountMaxA,
      slippage: percentageFromBps(args.slippage),
    });

    const mintBPubkey = new PublicKey(poolInfo.mintB.address);
    if (quote.amountB.amount.gt(amountMaxB) && !isNative(mintBPubkey)) {
      const mintBBalanceResponse =
        await dex.connection.getTokenAccountBalance(tokenBAta);
      const mintBBalance = new BN(mintBBalanceResponse.value.amount);
      if (quote.amountB.amount.gt(mintBBalance)) {
        const quoteResponse = await dex.swap.jupiter.jupiter.quoteGet({
          slippageBps: args.slippage,
          inputMint: poolInfo.mintB.address,
          outputMint: NATIVE_MINT.toBase58(),
          // @ts-expect-error
          amount: quote.amountB.amount.toString(),
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

    const {
      signers,
      extInfo,
      transaction: createPositionV0Transaction,
    } = await dex.clmm.raydium.raydium.clmm.openPositionFromBase({
      poolInfo,
      tickLower,
      tickUpper,
      base: "MintA",
      baseAmount: quote.amountA.amount,
      otherAmountMax: quote.amountSlippageB.amount,
      ownerInfo: {
        useSOLBalance: true,
      },
      txVersion: TxVersion.V0,
    });
    createPositionV0Transaction.sign(signers);

    positionMint = extInfo.nftMint;
    transactions = [
      closePositionV0Transaction,
      ...swapV0Transactions,
      createPositionV0Transaction,
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
