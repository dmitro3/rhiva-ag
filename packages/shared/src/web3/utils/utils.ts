import assert from "assert";
import chunk from "lodash.chunk";
import type { Address } from "@solana/kit";
import { Keypair, type PublicKey } from "@solana/web3.js";

import { mapFilter } from "../../collection";
import { KMSSecret, Secret } from "../../secret";

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

export const percentageFromBps = (value: number) =>
  value > 1 ? value / 100 : value;
