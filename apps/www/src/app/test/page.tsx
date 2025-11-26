"use client";
import { useMemo, useState } from "react";
import { MdOpenInNew } from "react-icons/md";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import Header from "@/components/layout/Header";
import BackgroundJobToast from "@/components/BackgroundJobToast";

export default function TestPage() {
  const { connection } = useConnection();
  let { publicKey } = useWallet();
  const [jobId, setJobId] = useState<string | undefined>();

  const _createTransaction = async () => {
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

  const sendTransaction = () => {
    setJobId(
      "bf38a4710be229ac8775c379487f99c0295fcdcee2d29383110007f1fb078fd2",
    );
  };

  const action = useMemo(
    () => (
      <MdOpenInNew
        size={18}
        className="fill-white"
      />
    ),
    [],
  );

  return (
    <div className="flex-1 flex flex-col ">
      <Header />
      <div className="flex-1 flex flex-col items-start">
        {jobId && (
          <BackgroundJobToast
            title="Bundle Sent"
            jobId={jobId}
            setJobId={setJobId}
            action={action}
            message={{
              success: "Position created",
              error: "Oops! Failed to confirm, try checking onchain",
              pending: "Confirming Transaction...",
            }}
          />
        )}
        <button
          type="submit"
          onClick={sendTransaction}
          className="p-2 bg-primary text-black rounded m-auto"
        >
          Send Transaction
        </button>
      </div>
    </div>
  );
}
