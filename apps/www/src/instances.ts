import { format } from "util";
import { DexApi } from "@rhiva-ag/dex-api";
import { Connection } from "@solana/web3.js";
import { SendTransaction } from "@rhiva-ag/shared";

export const dexApi = new DexApi();
export const solanaConnection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL!,
);
console.log(
  process.env.NEXT_PUBLIC_HELIUS_API_URL!,
  process.env.NEXT_PUBLIC_HELIUS_API_KEY!,
  process.env.NEXT_PUBLIC_JITO_API_URL!,
  process.env.NEXT_PUBLIC_JITO_UUID,
);
export const sendTransaction = new SendTransaction(
  process.env.NEXT_PUBLIC_HELIUS_API_URL!,
  process.env.NEXT_PUBLIC_HELIUS_API_KEY!,
  process.env.NEXT_PUBLIC_JITO_API_URL!,
  process.env.NEXT_PUBLIC_JITO_UUID,
  (url) => format("%s/proxy/?url=%s", process.env.NEXT_PUBLIC_API_URL!, url),
);
