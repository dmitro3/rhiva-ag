export type Uint64 = string;

export enum SwapMode {
  ExactIn = "ExactIn",
  ExactOut = "ExactOut",
}
export type SwapQuoteRequestQueryParams = {
  inputMint: string;
  outputMint: string;
  amount: Uint64;
  slippageBps?: number;
  swapMode?: SwapMode;
  dexes?: string[];
  excludeDexes?: string[];
  restricIntermediateTokens?: boolean;
  onlyDirectRoutes?: boolean;
  asLegacyTransation?: boolean;
  platformFeeBps?: number;
  maxAccounts?: number;
  instructionVersion?: "V1" | "V2";
  dynamicSlippage?: boolean;
};

type RoutePlan = {
  swapInfo: {
    ammKey: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    label: string;
    feeAmount: string;
    feeMint: string;
  };
  percentage: number;
  bps: number;
};

export type SwapQuoteResponse = {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: SwapMode;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: RoutePlan[];
  platformFee: {
    amount: string;
    feeBps: number;
  };
  contextSlot: number;
  timeTaken: number;
};

export type SwapRequestQueryParams = {
  userPublicKey: string;
  quoteResponse: SwapQuoteResponse;
  payer?: string;
  wrapAndUnwrapSol?: boolean;
  useSharedAccounts?: boolean;
  feeAccount?: string;
  trackingAccount?: string;
  prioritizationFeeLamports?:
    | {
        priorityLevelWithMaxLamports?: {
          global: boolean;
          maxLamports: Uint64;
          priorityLevel: "medium" | "high" | "veryHigh";
        };
      }
    | { jitoTipLamports?: Uint64 | number }
    | {
        jitoTipLamportsWithPayer?: {
          lamports: Uint64;
          payer: string;
        };
      };
  asLegacyTransaction?: boolean;
  destinationTokenAccount?: string;
  nativeDestinationAccount?: string;
  dynamicComputeUnitLimit?: boolean;
  skipUserAcccountsRpcCalls?: boolean;
  dynamicSlippage?: boolean;
  computeUnitPriceMicroLamports?: Uint64;
  blockhashSlotsToExpiry?: number;
};

export type SwapResponse = {
  swapTransaction: string;
  lastValidBlockHeight: Uint64;
  proritizationFeeLamport: Uint64;
};

export type SwapOrderRequestQueryParams = {
  inputMint: string;
  ouputMint: string;
  amount: Uint64;
  taker?: string;
  receiver?: string;
  payer?: string;
  closeAuthority?: string;
  referralAccount?: string;
  referralFee?: number;
  excludeRouters?: string;
  excludeDexes?: string;
};

export type SwapOrderResponse = {
  mode: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: {
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
    bps: number;
    usdValue: number;
  }[];
  feeBps: number;
  platformFee: { feeBps: number; amount: string }[];
  signatureFeeLamports: number;
  signatureFeePayer: string | null;
  prioritizationFeeLamports: number;
  prioritizationFeePayer: string | null;
  rentFeeLamports: number;
  rentFeePayer: string | null;
  swapType: string;
  router: string;
  transaction: string | null;
  gasless: boolean;
  requestId: string;
  totalTime: number;
  taker: string | null;
  inUsdValue: number;
  outUsdValue: number;
  priceImpact: number;
  swapUsdValue: number;
  referralAccount: string;
  feeMint: string;
  quoteId: string;
  maker: string;
  expireAt: string;
  errorCode: number;
  errorMessage: string;
};
