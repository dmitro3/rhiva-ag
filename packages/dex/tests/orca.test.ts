import { AccountLayout } from "@solana/spl-token";
import { beforeAll, describe, test, expect } from "bun:test";
import { mapFilter, SendTransaction } from "@rhiva-ag/shared";
import { createJupiterApiClient, type SwapApi } from "@jup-ag/api";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import {
  fetchWhirlpool,
  type Whirlpool,
} from "@orca-so/whirlpools-sdk/whirlpools-client";
import {
  Connection,
  type Keypair,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createSolanaRpc,
  type Account,
  type Address,
  createKeyPairSignerFromBytes,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  appendTransactionMessageInstructions,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  address,
  type RpcSimulateTransactionResult,
} from "@solana/kit";

import { getEnv } from "./env";
import { loadWallet } from "./utils";
import { OrcaDLMM } from "../src/dlmm/orca";
import { getTokenBalanceChangesFromSimulation } from "../src/utils";
import { fromLegacyPublicKey, fromVersionedTransaction } from "@solana/compat";

describe("orca", () => {
  let orca: OrcaDLMM;
  let jupiter: SwapApi;
  let wallet: Keypair;
  let pool: Account<Whirlpool, Address>;
  let connection: Connection;
  let sender: SendTransaction;
  let rpc: ReturnType<typeof createSolanaRpc>;
  let signer: Awaited<ReturnType<typeof createKeyPairSignerFromBytes>>;

  beforeAll(async () => {
    jupiter = createJupiterApiClient();
    wallet = loadWallet(getEnv("DEV_WALLET"));
    connection = new Connection(getEnv("SOLANA_RPC_URL"));
    rpc = createSolanaRpc(getEnv<string>("SOLANA_RPC_URL"));
    signer = await createKeyPairSignerFromBytes(wallet.secretKey);
    sender = new SendTransaction(
      getEnv("HELIUS_API_URL"),
      getEnv("HELIUS_API_KEY"),
      getEnv("JITO_API_URL"),
      getEnv("JITO_UUID"),
    );

    orca = new OrcaDLMM(rpc);
    pool = await fetchWhirlpool(
      rpc,
      address("Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE"),
    );
  });

  test("createPosition", async () => {
    const inputMint = NATIVE_MINT.toBase58();
    const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const amount = 10_000_000;

    const inputMintAta = getAssociatedTokenAddressSync(
      new PublicKey(inputMint),
      wallet.publicKey,
    );
    const outputMintAta = getAssociatedTokenAddressSync(
      new PublicKey(outputMint),
      wallet.publicKey,
    );
    const quoteResponse = await jupiter.quoteGet({
      inputMint,
      outputMint,
      amount,
      slippageBps: 50,
    });

    const swapResponse = await jupiter.swapPost({
      swapRequest: {
        quoteResponse,
        dynamicSlippage: true,
        dynamicComputeUnitLimit: true,
        userPublicKey: wallet.publicKey.toBase58(),
      },
    });

    const swapLegacyV0Transaction = VersionedTransaction.deserialize(
      Buffer.from(swapResponse.swapTransaction, "base64"),
    );
    swapLegacyV0Transaction.sign([wallet]);
    const swapV0Transaction = fromVersionedTransaction(swapLegacyV0Transaction);

    const simulateSwapResponse = await rpc
      .simulateTransaction(getBase64EncodedWireTransaction(swapV0Transaction), {
        encoding: "base64",
        accounts: {
          encoding: "base64",
          addresses: [
            fromLegacyPublicKey(inputMintAta),
            fromLegacyPublicKey(outputMintAta),
          ],
        },
        sigVerify: false,
        replaceRecentBlockhash: true,
      })
      .send();

    expect(simulateSwapResponse.value.err).toBe(null);

    const atas = [inputMintAta, outputMintAta];
    const preAccountInfos = await connection.getMultipleAccountsInfo(atas);
    const preTokenBalanceChanges = Object.fromEntries(
      mapFilter(preAccountInfos, (accountInfo) => {
        if (accountInfo) {
          const account = AccountLayout.decode(accountInfo.data);
          return [account.mint, account.amount];
        }
      }),
    );

    const tokenBalanceChanges = getTokenBalanceChangesFromSimulation(
      simulateSwapResponse.value as unknown as RpcSimulateTransactionResult,
      preTokenBalanceChanges,
    );

    const inputTokenB = tokenBalanceChanges[outputMint]!;

    const { instructions: fullInstructions } = await orca.buildCreatePosition({
      pool,
      slippage: 50,
      tokenA: BigInt(amount) / 2n,
      tokenB: inputTokenB / 2n,
      strategyType: "Full",
      owner: signer,
    });

    const { instructions: customInstructions } = await orca.buildCreatePosition(
      {
        pool,
        slippage: 50,
        tokenA: BigInt(amount) / 2n,
        tokenB: inputTokenB / 2n,
        strategyType: "Custom",
        owner: signer,
        tokenADecimals: 9,
        tokenBDecimals: 6,
        priceChanges: [0.01, 0.01],
      },
    );

    const { value: recentBlockhash } = await rpc.getLatestBlockhash().send();

    const createFullPositionV0Message = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(signer.address, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(recentBlockhash, tx),
      (tx) => appendTransactionMessageInstructions(fullInstructions, tx),
    );
    const createCustomPositionV0Message = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(signer.address, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(recentBlockhash, tx),
      (tx) => appendTransactionMessageInstructions(customInstructions, tx),
    );

    const createFullPositionV0Transaction =
      await signTransactionMessageWithSigners(createFullPositionV0Message);
    const createCustomPositionV0Transaction =
      await signTransactionMessageWithSigners(createCustomPositionV0Message);

    const bundleSimulationResponse = await sender.simulateBundle({
      skipSigVerify: true,
      transactions: [
        getBase64EncodedWireTransaction(swapV0Transaction),
        getBase64EncodedWireTransaction(createFullPositionV0Transaction),
        getBase64EncodedWireTransaction(createCustomPositionV0Transaction),
      ],
    });
    expect(bundleSimulationResponse.result.value.summary).toBe("succeeded");
  });
});
