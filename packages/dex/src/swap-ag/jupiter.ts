import xior, { type XiorInstance } from "xior";
import { buildPathWithQueryString } from "@rhiva-ag/shared";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
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
  constructor(readonly baseURL: string) {
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

  async buildSwap({
    owner,
    amount,
    slippage,
    inputMint,
    outputMint,
    destinationTokenAccount,
    prioritizationFeeLamports,
  }: SwapArgs) {
    const ownerPubkey = new PublicKey(owner);
    const inputMintPubkey = new PublicKey(inputMint);
    const outputMintPubkey = new PublicKey(outputMint);

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

    return { transaction: swapV0Transaction, quoteResponse };
  }
}
