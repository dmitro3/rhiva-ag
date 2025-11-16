import type { QuoteResponse, SwapApi } from "@jup-ag/api";
import { mapFilter, throwSimulationError } from "@rhiva-ag/shared";
import {
  AccountLayout,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PublicKey,
  type Connection,
  VersionedTransaction,
} from "@solana/web3.js";

import { getTokenBalanceChangesFromSimulation } from "../utils";

type SwapArgs = {
  owner: PublicKey;
  slippage: number;
  prioritizationFeeLamports?: {
    jitoTipLamports: number;
  };
  amount: string | bigint;
  inputMint: PublicKey | string;
  outputMint: PublicKey | string;
};

export class Jupiter {
  constructor(
    readonly jupiter: SwapApi,
    private readonly connection: Connection,
  ) {}

  buildSwap(args: SwapArgs & { skipSimulation?: false }): Promise<{
    transaction: VersionedTransaction;
    quote: { [k: string]: bigint };
    quoteResponse: QuoteResponse;
  }>;
  buildSwap(args: SwapArgs & { skipSimulation: true }): Promise<{
    transaction: VersionedTransaction;
    quoteResponse: QuoteResponse;
  }>;
  async buildSwap({
    owner,
    amount,
    slippage,
    inputMint,
    outputMint,
    skipSimulation,
  }: SwapArgs & { skipSimulation?: boolean }) {
    const inputMintPk = new PublicKey(inputMint);
    const outputMintPk = new PublicKey(outputMint);

    const inputMintAta = getAssociatedTokenAddressSync(inputMintPk, owner);
    const outputMintAta = getAssociatedTokenAddressSync(outputMintPk, owner);

    const quoteResponse = await this.jupiter.quoteGet({
      slippageBps: slippage,
      // @ts-expect-error jupiter v6 api expect bigint string
      amount: amount.toString(),
      inputMint: inputMintPk.toBase58(),
      outputMint: outputMintPk.toBase58(),
    });

    const swapResponse = await this.jupiter.swapPost({
      swapRequest: {
        quoteResponse,
        dynamicSlippage: true,
        dynamicComputeUnitLimit: true,
        userPublicKey: owner.toBase58(),
      },
    });

    const swapV0Transaction = VersionedTransaction.deserialize(
      Buffer.from(swapResponse.swapTransaction, "base64"),
    );

    if (skipSimulation)
      return { transaction: swapV0Transaction, quoteResponse };

    const atas = [inputMintAta, outputMintAta];
    const preAccountInfos = await this.connection.getMultipleAccountsInfo(atas);

    const preTokenBalanceChanges = Object.fromEntries(
      mapFilter(preAccountInfos, (accountInfo) => {
        if (accountInfo) {
          const account = AccountLayout.decode(accountInfo.data);
          return [account.mint, account.amount];
        }
      }),
    );

    const simulateSwapResponse = await this.connection.simulateTransaction(
      swapV0Transaction,
      {
        accounts: {
          encoding: "base64",
          addresses: atas.map((a) => a.toBase58()),
        },
        sigVerify: false,
        replaceRecentBlockhash: true,
      },
    );

    throwSimulationError(simulateSwapResponse.value);

    const tokenBalanceChanges = getTokenBalanceChangesFromSimulation(
      simulateSwapResponse.value,
      preTokenBalanceChanges,
    );

    return {
      quoteResponse,
      quote: tokenBalanceChanges,
      transaction: swapV0Transaction,
    };
  }
}
