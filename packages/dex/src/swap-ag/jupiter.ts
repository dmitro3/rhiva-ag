import xior, { type XiorInstance } from "xior";
import {
  mapFilter,
  throwSimulationError,
  buildPathWithQueryString,
  getTokenBalanceChangesFromSimulation,
} from "@rhiva-ag/shared";
import {
  AccountLayout,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PublicKey,
  type Connection,
  VersionedTransaction,
} from "@solana/web3.js";
import type {
  SwapResponse,
  SwapQuoteResponse,
  SwapRequestQueryParams,
  SwapQuoteRequestQueryParams,
} from "./types";

type SwapArgs = {
  slippage: number;
  owner: PublicKey | string;
  destinationTokenAccount?: PublicKey | string;
  prioritizationFeeLamports?: {
    jitoTipLamports: number;
  };
  amount: string | bigint;
  inputMint: PublicKey | string;
  outputMint: PublicKey | string;
};

export class Jupiter {
  readonly xior: XiorInstance;
  constructor(
    readonly baseURL: string,
    private readonly connection: Connection,
  ) {
    this.xior = xior.create({
      baseURL: this.baseURL,
    });
  }

  async quoteGet(params: SwapQuoteRequestQueryParams) {
    const { data } = await this.xior.get<SwapQuoteResponse>(
      buildPathWithQueryString("/swap/v1/quote", params),
    );

    return data;
  }

  async swapPost(params: SwapRequestQueryParams) {
    const { data } = await this.xior.post<SwapResponse>(
      "/swap/v1/swap",
      params,
    );
    return data;
  }

  buildSwap(args: SwapArgs & { skipSimulation?: false }): Promise<{
    transaction: VersionedTransaction;
    quote: { [k: string]: bigint };
    quoteResponse: SwapQuoteResponse;
  }>;
  buildSwap(args: SwapArgs & { skipSimulation: true }): Promise<{
    transaction: VersionedTransaction;
    quoteResponse: SwapQuoteResponse;
  }>;
  async buildSwap({
    owner,
    amount,
    slippage,
    inputMint,
    outputMint,
    skipSimulation,
    destinationTokenAccount,
    prioritizationFeeLamports,
  }: SwapArgs & { skipSimulation?: boolean }) {
    const ownerPubkey = new PublicKey(owner);
    const inputMintPubkey = new PublicKey(inputMint);
    const outputMintPubkey = new PublicKey(outputMint);

    const inputMintAta = getAssociatedTokenAddressSync(
      inputMintPubkey,
      outputMintPubkey,
    );
    const outputMintAta = getAssociatedTokenAddressSync(
      outputMintPubkey,
      ownerPubkey,
    );
    const quoteResponse = await this.quoteGet({
      slippageBps: slippage,
      amount: amount.toString(),
      inputMint: inputMintPubkey.toBase58(),
      outputMint: outputMintPubkey.toBase58(),
    });

    const swapResponse = await this.swapPost({
      quoteResponse,
      dynamicSlippage: true,
      prioritizationFeeLamports,
      dynamicComputeUnitLimit: true,
      userPublicKey: ownerPubkey.toBase58(),
      destinationTokenAccount: destinationTokenAccount
        ? new PublicKey(destinationTokenAccount).toBase58()
        : undefined,
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
