import type { Address } from "@solana/kit";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  NATIVE_MINT,
  NATIVE_MINT_2022,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export const isNative = (value: string | PublicKey | Address) => {
  const pubkey = new PublicKey(value);
  return NATIVE_MINT.equals(pubkey) || NATIVE_MINT_2022.equals(pubkey);
};

export const isSystemProgram = (value: string | PublicKey | Address) => {
  const pubkey = new PublicKey(value);
  return (
    SystemProgram.programId.equals(pubkey) || PublicKey.default.equals(pubkey)
  );
};

export const isTokenProgram = (value: string | PublicKey | Address) => {
  const pubkey = new PublicKey(value);
  return (
    TOKEN_PROGRAM_ID.equals(pubkey) || TOKEN_2022_PROGRAM_ID.equals(pubkey)
  );
};
