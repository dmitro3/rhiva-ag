import type { QuoteResponse, SwapApi } from "@jup-ag/api";
import {
  getTokenBalanceChangesFromSimulation,
  mapFilter,
  throwSimulationError,
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

    const quoteResponse = await this.jupiter.quoteGet({
      slippageBps: slippage,
      // @ts-expect-error jupiter v6 api expect bigint string
      amount: amount.toString(),
      inputMint: inputMintPubkey.toBase58(),
      outputMint: outputMintPubkey.toBase58(),
    });

    const swapResponse = await this.jupiter.swapPost({
      swapRequest: {
        quoteResponse,
        dynamicSlippage: true,
        prioritizationFeeLamports,
        dynamicComputeUnitLimit: true,
        userPublicKey: ownerPubkey.toBase58(),
        destinationTokenAccount: destinationTokenAccount
          ? new PublicKey(destinationTokenAccount).toBase58()
          : undefined,
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
