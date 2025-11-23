import z from "zod";
import { PublicKey } from "@solana/web3.js";
import { address as address_ } from "@solana/kit";

export const commaEnum = <T extends [string, ...string[]]>(values: T) => {
  const baseEnum = z.enum(values);
  const baseType = z.array(baseEnum);

  return z
    .union([
      z
        .string()
        .transform((value) =>
          value
            .split(/,/g)
            .map((value) => value.trim())
            .filter(Boolean),
        )
        .pipe(baseType),
      baseType,
    ])
    .transform((arr) => arr.join(","));
};

export const publicKey = () =>
  z
    .string()
    .min(32)
    .transform((value) => new PublicKey(value));

export const address = () =>
  z
    .string()
    .min(32)
    .transform((value) => address_(value));
