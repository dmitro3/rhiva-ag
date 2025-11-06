import chunk from "lodash.chunk";
import type {
  Address,
  Base64EncodedWireTransaction,
  Rpc,
  SimulateTransactionApi,
} from "@solana/kit";
import {
  Keypair,
  type Connection,
  PublicKey,
  type SimulateTransactionConfig,
  SystemProgram,
  type VersionedTransaction,
} from "@solana/web3.js";
import {
  NATIVE_MINT,
  NATIVE_MINT_2022,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { mapFilter } from "../collection";
import { KMSSecret, Secret } from "../secret";
import assert from "assert";

export const isNative = (value: string | PublicKey | Address) => {
  const pubkey = new PublicKey(value);
  return NATIVE_MINT.equals(pubkey) || NATIVE_MINT_2022.equals(pubkey);
};

export const isSystemProgram = (value: string | PublicKey | Address) => {
  const pubkey = new PublicKey(value);
  return SystemProgram.programId.equals(pubkey);
};

export const isTokenProgram = (value: string | PublicKey | Address) => {
  const pubkey = new PublicKey(value);
  return (
    TOKEN_PROGRAM_ID.equals(pubkey) || TOKEN_2022_PROGRAM_ID.equals(pubkey)
  );
};

export const batchRPCSimulateTransactions = (
  rpc: Rpc<SimulateTransactionApi>,
  {
    transactions,
    options,
  }: {
    transactions: Base64EncodedWireTransaction[];
    options: Exclude<
      Parameters<SimulateTransactionApi["simulateTransaction"]>[number],
      Base64EncodedWireTransaction
    >;
  },
) =>
  Promise.all(
    transactions.map((transaction) =>
      rpc
        .simulateTransaction(transaction, options)
        .send()
        .then(({ value }) => value),
    ),
  );

export const batchSimulateTransactions = (
  connection: Connection,
  {
    transactions,
    options,
  }: {
    transactions: VersionedTransaction[];
    options: SimulateTransactionConfig;
  },
) =>
  Promise.all(
    transactions.map((transaction) =>
      connection
        .simulateTransaction(transaction, options)
        .then(({ value }) => value),
    ),
  );

export async function loadWallet(
  wallet: { key: string | null; wrappedDek: string | null },
  secret: KMSSecret,
): Promise<Keypair>;
export async function loadWallet(
  wallet: { key: string | null; wrappedDex?: string },
  secret: Secret,
): Promise<Keypair>;
export async function loadWallet(
  wallet: { key: string | null; wrappedDex?: string },
  secret: Secret | KMSSecret,
): Promise<Keypair>;
export async function loadWallet(
  wallet:
    | { key: string | null }
    | { key: string | null; wrappedDek?: string | null },
  secret: KMSSecret | Secret,
) {
  assert(wallet.key, "expected key not to be null");

  let privateKey: string | undefined;
  if (
    secret instanceof KMSSecret &&
    "wrappedDek" in wallet &&
    wallet.wrappedDek
  )
    privateKey = await secret.decrypt<string>(wallet.key, {
      wrappedDek: wallet.wrappedDek,
    });
  else if (secret instanceof Secret) privateKey = secret.decrypt(wallet.key);

  if (privateKey)
    return Keypair.fromSecretKey(Buffer.from(privateKey, "base64"));

  throw new Error("[Not supported] unsupported key version");
}

export const chunkFetchMultipleAccounts = async <
  T extends PublicKey | Address,
  U extends Array<unknown>,
  V,
>(
  keys: T[],
  fetch: (keys: T[]) => Promise<U>,
  decoder?: (account: NonNullable<U[number]>) => V,
) => {
  const chunks = chunk(keys, 101);
  const accounts = await Promise.all(
    chunks.map(async (chunk) => {
      const accounts = await fetch(chunk);
      return mapFilter(accounts, (account, index) =>
        account
          ? ({
              publicKey: chunk[index]!,
              ...(decoder ? decoder(account) : account),
            } as V extends object
              ? V & { publicKey: T }
              : NonNullable<U[number]> & { publicKey: T })
          : null,
      );
    }),
  );
  return accounts.flat();
};
