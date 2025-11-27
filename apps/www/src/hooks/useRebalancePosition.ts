// import type z from "zod";
// import { useCallback } from "react";
// import type Dex from "@rhiva-ag/dex/browser";
// import type { TRPCClient } from "@trpc/client";
// import { fromWebWalletAdapter } from "@rhiva-ag/shared";
// import type { safeAuthUserSchema } from "@rhiva-ag/trpc";
// import type { WalletContextState } from "@solana/wallet-adapter-react";
// import {
//   meteoraClaimRewardSchema,
//   orcaClaimRewardSchema,
//   raydiumClaimRewardSchema,
//   rebalanceMeteoraPosition,
//   rebalanceOrcaPosition,
//   rebalanceRaydiumPosition,
//   type AppRouter,
// } from "@rhiva-ag/trpc/browser";

// import { sendTransaction } from "@/instances";
// import type { Position } from "./usePosition";

// export const useClaimPositionReward = (
//   dex: Dex,
//   wallet: WalletContextState,
//   trpcClient: TRPCClient<AppRouter>,
//   user: z.infer<typeof safeAuthUserSchema>,
// ) => {
//   const claimPosition = useCallback(
//     async (position: Position) => {
//       const value = {
//         pair: position.pool.id,
//         position: position.id,
//         slippage: user.settings.slippage * 100,
//         tokenA: {
//           mint: position.pool.baseToken.id,
//           owner: position.pool.baseToken.tokenProgram,
//           decimals: position.pool.baseToken.decimals,
//         },
//         tokenB: {
//           mint: position.pool.quoteToken.id,
//           owner: position.pool.quoteToken.tokenProgram,
//           decimals: position.pool.quoteToken.decimals,
//         },
//       };
//       const mapFunc = {
//         "saros-dlmm": undefined,
//         orca: trpcClient.position.orca.claim.mutate,
//         meteora: trpcClient.position.meteora.claim.mutate,
//         "raydium-clmm": trpcClient.position.raydium.claim.mutate,
//       };

//       const isExternal = user.wallet.external && wallet.publicKey;
//       let data: typeof value | { transactions: string[] } = value;

//       if (isExternal) {
//         const dexConfig = {
//           "saros-dlmm": undefined,
//           orca: {
//             fn: rebalanceOrcaPosition,
//             schema: orcaClaimRewardSchema,
//           },
//           "raydium-clmm": {
//             fn: rebalanceRaydiumPosition,
//             schema: raydiumClaimRewardSchema,
//           },
//           meteora: {
//             fn: rebalanceMeteoraPosition,
//             schema: meteoraClaimRewardSchema,
//           },
//         } as const;

//         const config = dexConfig[position.pool.dex];
//         if (config) {
//           const { fn, schema } = config;
//           const { transactions } = await fn(
//             dex,
//             sendTransaction,
//             fromWebWalletAdapter(wallet),
//             //@ts-expect-error force dynamic type here
//             schema.parse(value),
//           );

//           data = {
//             transactions: transactions.map((transaction) =>
//               transaction.serialize().toBase64(),
//             ),
//           };
//         }
//       }

//       const func = mapFunc[position.pool.dex];
//       if (func) return func(data);
//     },
//     [trpcClient, dex, user, wallet],
//   );

//   return claimPosition;
// };
