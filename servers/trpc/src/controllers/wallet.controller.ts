import type z from "zod";
import { eq } from "drizzle-orm";
import { Keypair } from "@solana/web3.js";
import { KMSSecret, type Secret } from "@rhiva-ag/shared";
import {
  wallets,
  type Database,
  type walletInsertSchema,
} from "@rhiva-ag/datasource";

export const createWallet = async (
  db: Database,
  secret: KMSSecret | Secret,
  input: Pick<z.infer<typeof walletInsertSchema>, "user" | "primary"> & {
    id?: string;
  },
  options?: {
    updatePrimary: boolean;
  },
) => {
  if (input.primary && options?.updatePrimary)
    await db
      .update(wallets)
      .set({
        primary: false,
      })
      .where(eq(wallets.user, input.user));
  let values: typeof wallets.$inferInsert;
  if (input.id) {
    values = {
      ...input,
      id: input.id,
      external: true,
      user: input.user,
    };
  } else {
    const keypair = Keypair.generate();
    let wrappedDek: string | undefined, encryptedText: string | undefined;

    if (secret instanceof KMSSecret) {
      const keypair = Keypair.generate();
      const { wrappedDek: dek, encryptedText: key } = await secret.encrypt(
        keypair.secretKey.toBase64(),
      );
      wrappedDek = dek;
      encryptedText = key;
    } else encryptedText = secret.encrypt(keypair.secretKey.toBase64());

    values = {
      ...input,
      wrappedDek,
      external: false,
      key: encryptedText,
      id: keypair.publicKey.toBase58(),
    };
  }

  const [wallet] = await db
    .insert(wallets)
    .values(values)
    .onConflictDoUpdate({
      target: [wallets.id],
      set: { primary: wallets.primary, external: wallets.external },
    })
    .returning();

  return wallet;
};
