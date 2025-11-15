"use client";
import Header from "@/components/layout/Header";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

export default function TestPage() {
  const { connection } = useConnection();
  let { publicKey } = useWallet();

  const createTransaction = async () => {
    publicKey = publicKey
      ? publicKey
      : new PublicKey("4nYVpmR3dUrbWB1uGRDA1vgjpcGy6zDac1PDiyi5BMbK");
    if (publicKey) {
      const { blockhash: recentBlockhash } =
        await connection.getLatestBlockhash();
      const message = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash,
        instructions: [
          SystemProgram.transfer({
            toPubkey: publicKey,
            fromPubkey: publicKey,
            lamports: 10,
          }),
        ],
      }).compileToV0Message();
      const tx = new VersionedTransaction(message);
      alert(tx.serialize().toBase64());
    }
  };
  return (
    <div className="flex-1 flex flex-col ">
      <Header />
      <div className="flex-1 flex flex-col items-center justify-center">
        <button
          type="submit"
          onClick={createTransaction}
          className="p-2 bg-primary text-black rounded"
        >
          Send Transaction
        </button>
      </div>
    </div>
  );
}
