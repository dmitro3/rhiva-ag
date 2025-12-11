import Decimal from "decimal.js";
import { beforeAll, describe, expect, test } from "bun:test";
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { getEnv } from "./env";
import { loadWallet } from "./utils";
import { SendTransaction } from "../src";
import { chunkArray } from "@raydium-io/raydium-sdk-v2";
import { formatProgramErrorFromSimulationBundleResponse } from "../src/web3/format-simulation-error";

describe("error", () => {
  let sender: SendTransaction;
  let connection: Connection;

  beforeAll(() => {
    connection = new Connection(clusterApiUrl("mainnet-beta"));
    sender = new SendTransaction(
      getEnv("HELIUS_API_URL"),
      getEnv("HELIUS_API_KEY"),
      getEnv("JITO_API_URL"),
      getEnv("JITO_UUID"),
    );
  });

  test("simulation error test", async () => {
    const wallet = loadWallet(getEnv("DEV_WALLET"));
    const reciever = new PublicKey(
      "DUhm8aTpGsaYzbo2JQ5hhrNf9KANxuQcqNXJSCQsWpfX",
    );

    const instructions = [];

    instructions.push(
      SystemProgram.transfer({
        toPubkey: reciever,
        fromPubkey: wallet.publicKey,
        lamports: BigInt(new Decimal(5).mul(Math.pow(10, 9)).toFixed(0)),
      }),
      SystemProgram.transfer({
        toPubkey: reciever,
        fromPubkey: wallet.publicKey,
        lamports: BigInt(new Decimal(4).mul(Math.pow(10, 9)).toFixed(0)),
      }),
    );

    // instructions.push(
    //   SystemProgram.transfer({
    //     toPubkey: reciever,
    //     fromPubkey: wallet.publicKey,
    //     lamports: BigInt(new Decimal(4).mul(Math.pow(10, 9)).toFixed(0)),
    //   }),
    // );

    const { blockhash: recentBlockhash } =
      await connection.getLatestBlockhash();
    const transactions = chunkArray(instructions, 2).map((instructions) => {
      const v0Message = new TransactionMessage({
        instructions,
        recentBlockhash,
        payerKey: wallet.publicKey,
      });

      return new VersionedTransaction(v0Message.compileToV0Message());
    });

    const bundleResponse = await sender.simulateBundle({
      transactions,
      skipSigVerify: true,
    });

    const result = formatProgramErrorFromSimulationBundleResponse(
      transactions,
      bundleResponse.result.value,
    );
    console.log(result);
    expect(result).toHaveLength(1);
  });
});
