import type z from "zod";
import type { SendTransaction, WalletAdapter } from "@rhiva-ag/shared";

import type { tokenSwapSchema } from "./token.schema";
import Decimal from "decimal.js";

type Dex =
  | import("@rhiva-ag/dex").default
  | import("@rhiva-ag/dex/browser").default;

export const swapToken = async (
  dex: Dex,
  wallet: WalletAdapter,
  sender: SendTransaction,
  {
    jitoConfig,
    ...input
  }: Exclude<z.infer<typeof tokenSwapSchema>, { transactions: string[] }>,
) => {
  const jitoTipLamports =
    jitoConfig.type === "dynamic"
      ? await sender.recentJitoTip(jitoConfig.priorityFeePercentile)
      : jitoConfig.amountLamport;

  const { quoteResponse, transaction } = await dex.swap.jupiter.buildSwap({
    ...input,
    owner: wallet.publicKey,
    prioritizationFeeLamports: {
      jitoTipLamports: Number(jitoTipLamports),
    },
    amount: new Decimal(input.amount)
      .mul(Math.pow(10, input.inputDecimals))
      .toFixed(0),
  });

  return {
    quoteResponse,
    transaction,
    async execute() {
      const { result } = await sender.sendBundle([transaction]);
      return result;
    },
  };
};
