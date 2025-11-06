import bs58 from "bs58";
import assert from "assert";
import nacl from "tweetnacl";
import type { Address, TransactionSigner } from "@solana/kit";
import type {
  Keypair,
  PublicKey,
  Signer,
  VersionedTransaction,
} from "@solana/web3.js";

type Message = {
  domain: string;
  publicKey: string;
  nonce?: string;
  statement: string;
};

export class SignMessage {
  nonce?: string;
  domain: string;
  publicKey: string;
  statement: string;

  constructor({ domain, publicKey, nonce, statement }: Message) {
    this.domain = domain;
    this.publicKey = publicKey;
    this.nonce = nonce;
    this.statement = statement;
  }

  prepare() {
    return [this.statement, this.nonce].filter(Boolean).join("");
  }

  async validate(signature: string) {
    const msg = this.prepare();
    const signatureUint8 = bs58.decode(signature);
    const msgUint8 = new TextEncoder().encode(msg);
    const pubKeyUint8 = bs58.decode(this.publicKey);

    return nacl.sign.detached.verify(msgUint8, signatureUint8, pubKeyUint8);
  }
}

export type WalletAdapter<
  T extends Address | PublicKey = PublicKey,
  U extends Keypair | Signer | TransactionSigner = Keypair | Signer,
> = {
  publicKey: T;
  signTransaction<T extends VersionedTransaction>(
    tx: T,
    keypairs?: U[],
  ): Promise<T>;
  signAllTransactions<T extends VersionedTransaction>(
    txs: T[],
    keypairs?: U[],
  ): Promise<T[]>;
};

export const fromKeyPairToWalletAdapter = (
  keypair: Keypair,
): WalletAdapter<PublicKey, Keypair | Signer> => ({
  publicKey: keypair.publicKey,
  async signTransaction(tx, keypairs = []) {
    tx.sign([keypair, ...keypairs]);
    return tx;
  },
  async signAllTransactions(txs, keypairs = []) {
    txs.forEach((tx) => {
      tx.sign([keypair, ...keypairs]);
    });
    return txs;
  },
});

export const fromWebWalletAdapter = (
  wallet: Pick<
    import("@solana/wallet-adapter-react").WalletContextState,
    "publicKey" | "signTransaction" | "signAllTransactions"
  >,
): WalletAdapter<PublicKey, Keypair | Signer> => {
  assert(wallet.publicKey, "publicKey required");
  assert(wallet.signTransaction, "signTransaction not implemented");
  return {
    publicKey: wallet.publicKey,
    signTransaction: (tx) => wallet.signTransaction!(tx),
    signAllTransactions: (txs) => {
      if (wallet.signAllTransactions) return wallet.signAllTransactions(txs);
      return Promise.all(txs.map((tx) => wallet.signTransaction(tx)));
    },
  };
};
