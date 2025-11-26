import type z from "zod";
import { useCallback } from "react";
import type Dex from "@rhiva-ag/dex/browser";
import type { TRPCClient } from "@trpc/client";
import { fromWebWalletAdapter } from "@rhiva-ag/shared";
import type { safeAuthUserSchema } from "@rhiva-ag/trpc";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  closeOrcaPosition,
  closeMeteoraPosition,
  closeRaydiumPosition,
  orcaClosePositionSchema,
  raydiumClosePositionSchema,
  meteoraClosePositionSchema,
  type AppRouter,
} from "@rhiva-ag/trpc/browser";

import { sendTransaction } from "@/instances";
import type { Position } from "./usePosition";

export const useClosePosition = (
  dex: Dex,
  wallet: WalletContextState,
  trpcClient: TRPCClient<AppRouter>,
  user: z.infer<typeof safeAuthUserSchema>,
) => {
  const closePosition = useCallback(
    async (position: Position) => {
      const value = {
        pair: position.pool.id,
        position: position.id,
        slippage: user.settings.slippage * 100,
        tokenA: {
          mint: position.pool.baseToken.id,
          owner: position.pool.baseToken.tokenProgram,
          decimals: position.pool.baseToken.decimals,
        },
        tokenB: {
          mint: position.pool.quoteToken.id,
          owner: position.pool.quoteToken.tokenProgram,
          decimals: position.pool.quoteToken.decimals,
        },
      };
      const mapFunc = {
        "saros-dlmm": undefined,
        orca: trpcClient.position.orca.close.mutate,
        meteora: trpcClient.position.meteora.close.mutate,
        "raydium-clmm": trpcClient.position.raydium.close.mutate,
      };

      const isExternal = user.wallet.external && wallet.publicKey;
      let data: typeof value | { transactions: string[] } = value;

      if (isExternal) {
        const dexConfig = {
          "saros-dlmm": undefined,
          orca: {
            fn: closeOrcaPosition,
            schema: orcaClosePositionSchema,
          },
          "raydium-clmm": {
            fn: closeRaydiumPosition,
            schema: raydiumClosePositionSchema,
          },
          meteora: {
            fn: closeMeteoraPosition,
            schema: meteoraClosePositionSchema,
          },
        } as const;

        const config = dexConfig[position.pool.dex];
        if (config) {
          const { fn, schema } = config;
          const { transactions } = await fn(
            dex,
            sendTransaction,
            fromWebWalletAdapter(wallet),
            //@ts-expect-error force dynamic type here
            schema.parse(value),
          );

          data = {
            transactions: transactions.map((transaction) =>
              transaction.serialize().toBase64(),
            ),
          };
        }
      }

      const func = mapFunc[position.pool.dex];
      if (func) return func(data);
    },
    [trpcClient, dex, user, wallet],
  );

  return closePosition;
};
