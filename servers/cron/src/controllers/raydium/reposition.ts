import type z from "zod";
import { PublicKey } from "@solana/web3.js";
import type Dex from "@rhiva-ag/dex";
import { fromLegacyPublicKey } from "@solana/compat";
import { repositionRaydiumPosition } from "@rhiva-ag/trpc";
import type {
  positionSelectSchema,
  settingsSelectSchema,
  walletSchema,
} from "@rhiva-ag/datasource";
import {
  fromKeyPairToWalletAdapter,
  loadWallet,
  type KMSSecret,
  type SendTransaction,
} from "@rhiva-ag/shared";

import { Work } from "../../constants";
import { createQueue } from "../../../../trpc/src/routers/positions/shared";

export const repositionRaydiumPositions = async (
  {
    dex,
    sender,
    settings,
    secret,
    ...args
  }: {
    dex: Dex;
    secret: KMSSecret;
    sender: SendTransaction;
    settings: z.infer<typeof settingsSelectSchema>;
    wallet: Pick<
      z.infer<typeof walletSchema>,
      "id" | "key" | "user" | "wrappedDek"
    >;
  },
  ...positions: Pick<z.infer<typeof positionSelectSchema>, "id" | "pool">[]
) => {
  const queue = createQueue();
  for (const position of positions) {
    const wallet = await loadWallet(args.wallet, secret);
    const { execute, positionMint } = await repositionRaydiumPosition(
      dex,
      sender,
      fromKeyPairToWalletAdapter(wallet),
      {
        type: settings.rebalanceType,
        slippage: settings.slippage * 100,
        pair: new PublicKey(position.pool.id),
        position: new PublicKey(position.id),
        jitoConfig: {
          type: "dynamic",
          priorityFeePercentile: "50ema",
        },
      },
    );

    const bundleId = await execute();
    await queue.add(Work.syncTransaction, {
      bundleId,
      dex: "raydium-clmm",
      type: "repositioned",
      wallet: {
        id: args.wallet.id,
        user: args.wallet.user,
      },
      positionMint: fromLegacyPublicKey(positionMint),
    });
  }
};
