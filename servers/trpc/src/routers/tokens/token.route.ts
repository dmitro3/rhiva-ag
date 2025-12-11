import z from "zod";
import Dex from "@rhiva-ag/dex";
import Decimal from "decimal.js";
import { TRPCError } from "@trpc/server";
import { rewards } from "@rhiva-ag/datasource";
import { createTransferCheckedInstruction } from "@solana/spl-token";
import type { TradeGetResponse } from "@coingecko/coingecko-typescript/resources/onchain/networks/pools/trades.js";
import type { OhlcvGetTimeframeResponse } from "@coingecko/coingecko-typescript/resources/onchain/networks/pools/ohlcv.js";
import {
  isNative,
  loadWallet,
  fromKeyPairToWalletAdapter,
} from "@rhiva-ag/shared";
import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import { swapToken } from "./token.controller";
import { privateProcedure, publicProcedure, router } from "../../trpc";
import {
  tokenChartFilter,
  tokenSendSchema,
  tokenSwapSchema,
  tokenTradeFilter,
} from "./token.schema";

export const tokenRoute = router({
  chart: publicProcedure
    .input(
      z.object({
        network: z.enum(["solana"]),
        token_address: z.string(),
        timeframe: z.enum(["day", "hour", "minute", "second"]),
        filter: tokenChartFilter.optional(),
      }),
    )
    .query(async ({ ctx, input: { filter, timeframe, ...input } }) => {
      const response =
        await ctx.coingecko.onchain.networks.tokens.ohlcv.getTimeframe(
          timeframe,
          {
            ...input,
            ...filter,
          },
        );

      return {
        base_token: response.meta?.base,
        quote_token: response.meta?.quote,
        ohlcv_list: response.data?.attributes?.ohlcv_list,
      } as NonNullable<OhlcvGetTimeframeResponse.Data["attributes"]> & {
        base_token: NonNullable<OhlcvGetTimeframeResponse.Meta.Base>;
        quote_token: NonNullable<OhlcvGetTimeframeResponse.Meta.Quote>;
      };
    }),
  trades: publicProcedure
    .input(
      z.object({
        token_address: z.string(),
        network: z.enum(["solana"]),
        filter: tokenTradeFilter.optional(),
      }),
    )
    .query(async ({ ctx, input: { token_address, ...input } }) => {
      const response = await ctx.coingecko.onchain.networks.pools.trades.get(
        token_address,
        input,
      );

      return response.data?.map(
        (data) => data.attributes,
      ) as NonNullable<TradeGetResponse.Data.Attributes>[];
    }),
  swap: privateProcedure
    .input(tokenSwapSchema)
    .mutation(async ({ ctx, input }) => {
      let bundleId: string;
      let quoteResponse: { inAmount: string; outAmount: string };

      if ("transactions" in input) {
        quoteResponse = input.quoteResponse;
        bundleId = await ctx.sendTransaction
          .sendBundle(input.transactions)
          .then(({ result }) => result);
      } else {
        if (ctx.user.wallet.external)
          throw new TRPCError({
            code: "NOT_IMPLEMENTED",
            message: "external wallet not supported",
          });

        const wallet = await loadWallet(ctx.user.wallet, ctx.secret);
        const { execute, ...rest } = await swapToken(
          new Dex(ctx.connection),
          fromKeyPairToWalletAdapter(wallet),
          ctx.sendTransaction,
          input,
        );

        bundleId = await execute();
        quoteResponse = rest.quoteResponse;
      }

      const prices = (await ctx.coingecko.simple.tokenPrice.getID("solana", {
        vs_currencies: "usd",
        contract_addresses: [input.inputMint, input.outputMint].join(","),
      })) as Record<string, { usd: number }>;

      let amountUsd = 0;
      const rawInputAmount = quoteResponse.inAmount;
      const rawOutputAmount = quoteResponse.outAmount;

      if (rawInputAmount) {
        const inputAmount = new Decimal(rawInputAmount)
          .div(Math.pow(10, input.inputDecimals))
          .toNumber();
        const price = prices[input.inputMint];
        if (price) amountUsd += price.usd * inputAmount;
      }

      if (rawOutputAmount) {
        const outputAmount = new Decimal(rawOutputAmount)
          .div(Math.pow(10, input.outputDecimals))
          .toNumber();
        const price = prices[input.outputMint];
        if (price) amountUsd += price.usd * outputAmount;
      }
      if (amountUsd > 0)
        await ctx.drizzle.insert(rewards).values({
          key: "swap",
          user: ctx.user.id,
          xp: Math.floor(amountUsd),
        });

      return bundleId;
    }),
  send: privateProcedure
    .input(tokenSendSchema)
    .mutation(async ({ ctx, input }) => {
      if ("transactions" in input) {
        const [transaction] = input.transactions as [string];
        const v0Transaction = VersionedTransaction.deserialize(
          Buffer.from(transaction, "base64"),
        );
        return await ctx.connection.sendTransaction(v0Transaction);
      } else {
        if (ctx.user.wallet.external)
          throw new TRPCError({
            code: "NOT_IMPLEMENTED",
            message: "external wallet not supported",
          });

        const transferInstructions: TransactionInstruction[] = [];
        const owner = new PublicKey(ctx.user.wallet.id);
        const wallet = await loadWallet(ctx.user.wallet, ctx.secret);

        if (isNative(input.inputMint))
          transferInstructions.push(
            SystemProgram.transfer({
              fromPubkey: owner,
              toPubkey: input.recipient,
              lamports: input.inputAmount,
            }),
          );
        else {
          const fromAta = getAssociatedTokenAddressSync(
            input.inputMint,
            owner,
            false,
            input.inputTokenProgram,
          );
          const toAta = getAssociatedTokenAddressSync(
            input.inputMint,
            input.recipient,
            false,
            input.inputTokenProgram,
          );
          transferInstructions.push(
            createAssociatedTokenAccountIdempotentInstruction(
              owner,
              toAta,
              owner,
              input.inputMint,
              input.inputTokenProgram,
            ),
          );
          transferInstructions.push(
            createTransferCheckedInstruction(
              fromAta,
              input.inputMint,
              toAta,
              owner,
              input.inputAmount,
              input.inputDecimals,
              undefined,
              input.inputTokenProgram,
            ),
          );
        }
        const { blockhash: recentBlockhash } =
          await ctx.connection.getLatestBlockhash();
        const v0Message = new TransactionMessage({
          payerKey: owner,
          recentBlockhash,
          instructions: transferInstructions,
        }).compileToV0Message();
        const v0Transaction = new VersionedTransaction(v0Message);

        const simulateResponse = await ctx.connection.simulateTransaction(
          v0Transaction,
          {
            sigVerify: false,
            replaceRecentBlockhash: true,
          },
        );
        if (simulateResponse.value.err) throw simulateResponse.value.err;

        v0Transaction.sign([wallet]);

        return ctx.connection.sendTransaction(v0Transaction);
      }
    }),
});
