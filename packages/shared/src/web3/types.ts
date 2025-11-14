import type {
  TransactionConfirmationStatus,
  TransactionError,
} from "@solana/web3.js";

export type SimulateBundleRequest = {
  method: "simulateBundle";
  params: {
    simulationBank?: string;
    skipSigVerify?: boolean;
    replaceRecentBlockhash?: boolean;
    accounts?: {
      encoding: "base64";
      addresses: string[];
    };
    preExecutionAccountsConfigs?: {
      accountIndex?: number;
      address: string[];
    }[];
    postExecutionAccountsConfigs?: {
      accountIndex?: number;
      address: string[];
    }[];
    encodedTransactions: string[];
  }[];
};

export type SimulateBundleResponse = {
  summary:
    | "succeeded"
    | { failed: { error: { TransactionFailure: [number[] | string] } } };
  transactionResults: {
    err: TransactionError | null;
    logs: string[];
    preExecutionAccounts: AccountState[];
    postExecutionAccounts: AccountState[];
    unitsConsumed: number;
    returnData: {
      programId: string;
      data: string;
    };
  }[];
};

type AccountState = {
  lamports: number;
  owner: string;
  data: string;
  executable: boolean;
  rentEpoch: number;
};

export type SendBundleRequest = {
  method: "sendBundle";
  params: [string[], { encoding: "base64" }];
};

export type SendBundleResponse = {
  result: string;
};

export type GetBundleStatusesRequest = {
  params: [string[]];
  method: "getBundleStatuses";
};

export type GetBundleStatusesResponse =
  | null
  | {
      slot: number;
      bundle_id: string;
      transactions: string[];
      confirmationStatus: TransactionConfirmationStatus;
      err: {
        ok: null;
      };
    }
  | { bundle_id: string; status: "Invalid"; confirmation_slot: null };

export type GetInflightBundleStatusesRequest = {
  params: [string[]];
  method: "getInflightBundleStatuses";
};

export type GetInflightBundleStatusesResponse = null | {
  bundle_id: string;
  landed_slot: number | null;
  status: "Invalid" | "Pending" | "Failed" | "Landed";
};

export type SolanaRPCResponse<T> = {
  jsonrpc: string;
  id: string;
  result: T;
};

export type Percentile = "25" | "50" | "75" | "95" | "99" | "50ema";

export type JitoFeeConfig =
  | {
      type: "dynamic";
      priorityFeePercentitle?: Percentile;
    }
  | { type: "exact"; amountLamport: bigint };

export const PercentileToKey = {
  "25": "landed_tips_25th_percentile",
  "50": "landed_tips_50th_percentile",
  "75": "landed_tips_75th_percentile",
  "95": "landed_tips_95th_percentile",
  "99": "landed_tips_99th_percentile",
  "50ema": "ema_landed_tips_50th_percentile",
} as const;

export type BundleResponse = {
  bundleId: string;
  slot: number;
  validator: string;
  tippers: string[];
  landedTipLamports: number;
  landedCu: number;
  blockIndex: number;
  timestamp: string;
  txSignatures: string[];
};
