import xior from "xior";
import { format } from "util";
import { fromLegacyPublicKey } from "@solana/compat";
import { lamports, type TransactionSigner } from "@solana/kit";
import {
  getTransferSolInstruction,
  type TransferSolInstruction,
} from "@solana-program/system";
import {
  VersionedTransaction,
  type RpcResponseAndContext,
  SystemProgram,
  PublicKey,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";

import { sleep } from "../utils";
import {
  PercentileToKey,
  type BundleResponse,
  type GetBundleStatusesRequest,
  type GetBundleStatusesResponse,
  type GetInflightBundleStatusesRequest,
  type JitoFeeConfig,
  type Percentile,
  type SendBundleRequest,
  type SimulateBundleRequest,
  type SimulateBundleResponse,
  type SolanaRPCResponse,
} from "./types";

export * from "./utils";
export * from "./errors";
export * from "./sign-message";
export type { SimulateBundleResponse, JitoFeeConfig };

export class SendTransaction {
  private readonly heliusURL: string;
  static readonly blockEngineURL = "https://bundles.jito.wtf";

  static jitoTipAddresses = [
    "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
    "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
    "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
    "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
    "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
    "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
    "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
  ];

  constructor(
    heliusApiURL: string,
    heliusApiKey: string,
    private readonly jitoApiURL: string,
    private readonly jitoUUID?: string,
    private readonly getProxyUrl?: (url: string) => string,
  ) {
    this.heliusURL = format("%s?api-key=%s", heliusApiURL, heliusApiKey);
  }

  readonly sendRPCRequest = async <T>(
    url: string,
    request:
      | SimulateBundleRequest
      | SendBundleRequest
      | GetBundleStatusesRequest
      | GetInflightBundleStatusesRequest,
    headers?: Headers,
  ) => {
    return xior.post<T>(
      url,
      {
        ...request,
        id: crypto.randomUUID(),
        jsonrpc: "2.0",
      },
      { headers },
    );
  };

  readonly simulateBundle = async ({
    transactions,
    ...params
  }: { transactions: (VersionedTransaction | string)[] } & Omit<
    SimulateBundleRequest["params"][1],
    "encodedTransactions"
  >) => {
    return this.sendRPCRequest<
      SolanaRPCResponse<RpcResponseAndContext<SimulateBundleResponse>>
    >(this.heliusURL, {
      method: "simulateBundle",
      params: [
        {
          encodedTransactions: transactions.map((transaction) =>
            transaction instanceof VersionedTransaction
              ? transaction.serialize().toBase64()
              : transaction,
          ),
        },
        {
          preExecutionAccountsConfigs: Array.from<null>({
            length: transactions.length,
          }).fill(null),
          postExecutionAccountsConfigs: Array.from<null>({
            length: transactions.length,
          }).fill(null),
          ...params,
        },
      ],
    }).then(({ data }) => data);
  };

  readonly sendBundle = async (
    transactions: (VersionedTransaction | string)[],
  ) => {
    return this.sendRPCRequest<SolanaRPCResponse<string>>(
      format("%s/api/v1/bundles?uuid=%s", this.jitoApiURL, this.jitoUUID),
      {
        method: "sendBundle",
        params: [
          transactions.map((transaction) =>
            transaction instanceof VersionedTransaction
              ? transaction.serialize().toBase64()
              : transaction,
          ),
          { encoding: "base64" },
        ],
      },
    ).then(({ data }) => data);
  };

  readonly getBundles = async (...bundleIds: string[]) => {
    const url = format(
      "%s/api/v1/bundles/bundle/%s",
      SendTransaction.blockEngineURL,
      bundleIds.join(","),
    );
    return xior
      .get<BundleResponse[]>(this.getProxyUrl ? this.getProxyUrl(url) : url)
      .then(({ data }) => data);
  };

  readonly safeGetBundle = async (bundleId: string, maxRetries: number) => {
    let retries = 0;

    while (retries < maxRetries) {
      const preflights = await this.getInflightBundleStatuses(bundleId).catch(
        () => null,
      );
      const preflight = preflights?.result.value.find(
        (value) => value?.bundle_id === bundleId,
      );
      if (preflight) {
        if ("status" in preflight && preflight.status === "Invalid") break;
        if ("transactions" in preflight)
          return {
            transactions: preflight.transactions,
          };
      }

      retries++;
      await sleep(retries * 5_000);
    }

    retries = 0;
    while (retries < maxRetries) {
      const bundles = await this.getBundles(bundleId).catch(() => null);
      const bundle = bundles?.find((value) => value.bundleId === bundleId);
      if (bundle)
        return {
          transactions: bundle.txSignatures,
        };

      retries++;
      await sleep(retries * 10_000);
    }

    throw new Error("Bundle did not land");
  };

  readonly getBundleStatuses = async (...bundleIds: string[]) => {
    return this.sendRPCRequest<
      SolanaRPCResponse<RpcResponseAndContext<GetBundleStatusesResponse[]>>
    >(
      format(
        "%s/api/v1/getBundleStatuses?uuid=%s",
        this.jitoApiURL,
        this.jitoUUID,
      ),
      {
        params: [bundleIds],
        method: "getBundleStatuses",
      },
    ).then(({ data }) => data);
  };

  readonly getInflightBundleStatuses = async (...bundleIds: string[]) => {
    return this.sendRPCRequest<
      SolanaRPCResponse<RpcResponseAndContext<GetBundleStatusesResponse[]>>
    >(
      format(
        "%s/api/v1/getInflightBundleStatuses?uuid=%s",
        this.jitoApiURL,
        this.jitoUUID,
      ),
      {
        params: [bundleIds],
        method: "getInflightBundleStatuses",
      },
    ).then(({ data }) => data);
  };

  processJitoTipFromTxMessage(
    owner: PublicKey,
    transaction: TransactionInstruction[],
    config: JitoFeeConfig,
  ): Promise<TransactionInstruction[]>;
  processJitoTipFromTxMessage(
    owner: PublicKey,
    transaction: Transaction,
    config: JitoFeeConfig,
  ): Promise<Transaction>;
  processJitoTipFromTxMessage(
    owner: TransactionSigner,
    config: JitoFeeConfig,
  ): Promise<TransferSolInstruction>;
  async processJitoTipFromTxMessage(
    owner: PublicKey | TransactionSigner,
    transaction: Transaction | TransactionInstruction[] | JitoFeeConfig,
    config?: JitoFeeConfig,
  ) {
    let jitoTipLamports = BigInt(0);
    const tipAddress = SendTransaction.getJitoTipAddress();
    const jitoConfig = config ? config : (transaction as JitoFeeConfig);

    if (jitoConfig.type === "exact") jitoTipLamports = jitoConfig.amountLamport;
    else if (jitoConfig.type === "dynamic")
      jitoTipLamports = await this.recentJitoTip(
        jitoConfig.priorityFeePercentitle,
      );
    if (jitoTipLamports > BigInt(0)) {
      if (transaction instanceof Transaction)
        transaction.instructions = [
          SystemProgram.transfer({
            toPubkey: tipAddress,
            lamports: jitoTipLamports,
            fromPubkey: owner as PublicKey,
          }),
          ...transaction.instructions,
        ];
      else if (Array.isArray(transaction))
        return [
          ...transaction,
          SystemProgram.transfer({
            toPubkey: tipAddress,
            lamports: jitoTipLamports,
            fromPubkey: owner as PublicKey,
          }),
        ];
      else
        return getTransferSolInstruction({
          source: owner as TransactionSigner,
          amount: jitoTipLamports,
          destination: fromLegacyPublicKey(tipAddress),
        });

      return transaction;
    }

    return transaction;
  }

  async getJitoTipInstruction(
    owner: PublicKey,
    jitoConfig: JitoFeeConfig,
  ): Promise<TransactionInstruction | undefined> {
    let jitoTipLamports = BigInt(0);
    const tipAddress = SendTransaction.getJitoTipAddress();

    if (jitoConfig.type === "exact") jitoTipLamports = jitoConfig.amountLamport;
    else if (jitoConfig.type === "dynamic")
      jitoTipLamports = await this.recentJitoTip(
        jitoConfig.priorityFeePercentitle,
      );
    if (jitoTipLamports > BigInt(0))
      return SystemProgram.transfer({
        toPubkey: tipAddress,
        lamports: jitoTipLamports,
        fromPubkey: owner as PublicKey,
      });
  }

  readonly recentJitoTip = async (
    priorityFeePercentitle: Percentile = "50",
  ) => {
    const url = format(
      "%s%s",
      SendTransaction.blockEngineURL,
      "/api/v1/bundles/tip_floor",
    );
    const {
      data: [result],
      response,
    } = await xior.get(this.getProxyUrl ? this.getProxyUrl(url) : url);

    if (!response.ok) return BigInt(0);

    const key = PercentileToKey[priorityFeePercentitle];

    if (key)
      return lamports(
        BigInt(Math.floor(Number(result[key]) * Math.pow(10, 9))),
      ).valueOf();

    return BigInt(0);
  };

  static getJitoTipAddress(): PublicKey {
    const index = Math.floor(
      Math.random() * SendTransaction.jitoTipAddresses.length,
    );

    return new PublicKey(SendTransaction.jitoTipAddresses[index]!);
  }
}
