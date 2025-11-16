import { getTokenDecoder } from "@solana-program/token";
import {
  isNative,
  isSystemProgram,
  isTokenProgram,
  mapFilter,
  type SimulateBundleResponse,
} from "@rhiva-ag/shared";
import { AccountLayout, NATIVE_MINT, type RawAccount } from "@solana/spl-token";
import type {
  Address,
  Rpc,
  RpcSimulateTransactionResult,
  SolanaRpcApiMainnet,
} from "@solana/kit";
import {
  Connection,
  PublicKey,
  type SimulatedTransactionResponse,
} from "@solana/web3.js";

export const getTokenBalanceChangesFromSimulation = (
  result: RpcSimulateTransactionResult | SimulatedTransactionResponse,
  preTokenBalanceChanges: Record<string, bigint>,
) => {
  const postTokenBalanceChanges: Record<string, bigint> = {};
  if (result.accounts)
    for (const account of result.accounts) {
      if (account?.owner)
        if (isTokenProgram(account.owner)) {
          let data: RawAccount;
          if (Array.isArray(account.data)) {
            const [encodedData, encoding] = account.data;

            data = AccountLayout.decode(
              Buffer.from(encodedData, encoding as BufferEncoding),
            );
          } else if (account.data instanceof Object)
            data = account.data.parsed as RawAccount;
          else throw new Error("unsupported encoding");

          postTokenBalanceChanges[data.mint.toBase58()] = data.amount;
        } else if (
          isSystemProgram(account.owner) &&
          "space" in account &&
          account.space === 0
        ) {
          postTokenBalanceChanges[NATIVE_MINT.toBase58()] = BigInt(
            account.lamports,
          );
        }
    }

  const tokens = [
    ...new Set([
      ...Object.keys(preTokenBalanceChanges),
      ...Object.keys(postTokenBalanceChanges),
    ]),
  ];

  return Object.fromEntries(
    tokens.map((mint) => {
      const pre = preTokenBalanceChanges[mint] ?? BigInt(0);
      const post = postTokenBalanceChanges[mint] ?? BigInt(0);

      return [mint, post - pre];
    }),
  );
};

export const getTokenBalanceChangesFromBatchSimulation = (
  results: (RpcSimulateTransactionResult | SimulatedTransactionResponse)[],
  preTokenBalanceChanges: Record<string, bigint>,
) => {
  const globalTokenBalanceChanges: Record<string, bigint> = {};

  for (const result of results) {
    const tokenBalanceChanges = getTokenBalanceChangesFromSimulation(
      result,
      preTokenBalanceChanges,
    );

    for (const [mint, value] of Object.entries(tokenBalanceChanges)) {
      const amount = globalTokenBalanceChanges[mint] ?? BigInt(0);
      globalTokenBalanceChanges[mint] = amount + value;
    }
  }

  return globalTokenBalanceChanges;
};

export const getTokenBalanceChangesFromBundleSimulation = (
  result: SimulateBundleResponse,
) => {
  const tokenBalanceChanges: Record<string, bigint> = {};

  for (const transaction of result.transactionResults) {
    const preTokenBalanceChanges: Record<string, bigint> = {};
    const postTokenBalanceChanges: Record<string, bigint> = {};

    for (const account of transaction.preExecutionAccounts) {
      if (isTokenProgram(account.owner)) {
        const data = AccountLayout.decode(Buffer.from(account.data, "base64"));
        preTokenBalanceChanges[data.mint.toBase58()] = data.amount;
      } else if (
        isSystemProgram(account.owner) &&
        "space" in account &&
        account.space === 0
      ) {
        preTokenBalanceChanges[NATIVE_MINT.toBase58()] = BigInt(
          account.lamports,
        );
      }
    }
    for (const account of transaction.postExecutionAccounts) {
      if (isTokenProgram(account.owner)) {
        const data = AccountLayout.decode(Buffer.from(account.data, "base64"));
        postTokenBalanceChanges[data.mint.toBase58()] = data.amount;
      } else if (
        isSystemProgram(account.owner) &&
        "space" in account &&
        account.space === 0
      ) {
        postTokenBalanceChanges[NATIVE_MINT.toBase58()] = BigInt(
          account.lamports,
        );
      }
    }

    const tokens = [
      ...new Set([
        ...Object.keys(preTokenBalanceChanges),
        ...Object.keys(postTokenBalanceChanges),
      ]),
    ];

    for (const token of tokens) {
      const pre = preTokenBalanceChanges[token] ?? BigInt(0);
      const post = postTokenBalanceChanges[token] ?? BigInt(0);
      const previous = tokenBalanceChanges[token] ?? BigInt(0);

      tokenBalanceChanges[token] = previous + post - pre;
    }
  }

  return tokenBalanceChanges;
};

export function getPreTokenBalanceForAccounts(
  rpc: Rpc<SolanaRpcApiMainnet>,
  accounts: Address[],
): Promise<Record<string, bigint>>;
export function getPreTokenBalanceForAccounts(
  connection: Connection,
  accounts: PublicKey[],
): Promise<Record<string, bigint>>;
export async function getPreTokenBalanceForAccounts(
  connection: Connection | Rpc<SolanaRpcApiMainnet>,
  accounts: PublicKey[] | Address[],
): Promise<Record<string, bigint>> {
  if (connection instanceof Connection) {
    const accountInfos = await connection.getMultipleAccountsInfo(
      accounts as PublicKey[],
    );
    return Object.fromEntries(
      mapFilter(accountInfos, (accountInfo, index) => {
        const pubkey = accounts[index];
        if (accountInfo) {
          if (pubkey && isNative(accountInfo.owner))
            return [new PublicKey(pubkey).toBase58(), accountInfo.lamports];
          else {
            const account = AccountLayout.decode(accountInfo.data);
            return [account.mint.toBase58(), account.amount];
          }
        }

        return null;
      }),
    );
  }

  const tokenDecoder = getTokenDecoder();
  const { value: accountInfos } = await connection
    .getMultipleAccounts(accounts as Address[])
    .send();

  return Object.fromEntries(
    mapFilter(accountInfos, (accountInfo) => {
      if (accountInfo) {
        const [data, encoding] = accountInfo.data;
        const account = tokenDecoder.decode(Buffer.from(data, encoding));
        return [account.mint, account.amount];
      }

      return null;
    }),
  );
}
