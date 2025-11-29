import type z from "zod";
import type Dex from "@rhiva-ag/dex";
import { PublicKey } from "@solana/web3.js";
import { rebalanceMeteoraPosition } from "@rhiva-ag/trpc";
import {
  fromKeyPairToWalletAdapter,
  loadWallet,
  type KMSSecret,
  type SendTransaction,
} from "@rhiva-ag/shared";
import type {
  positionSelectSchema,
  settingsSelectSchema,
  walletSchema,
} from "@rhiva-ag/datasource";

import { Work } from "../../constants";
import { createQueue } from "../../../../trpc/src/routers/positions/shared";

export const rebalanceMeteoraPositions = async (
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
    settings: Pick<z.infer<typeof settingsSelectSchema>, "slippage">;
    wallet: Pick<
      z.infer<typeof walletSchema>,
      "id" | "user" | "key" | "wrappedDek"
    >;
  },
  ...positions: (Pick<z.infer<typeof positionSelectSchema>, "id"> & {
    pool: { id: string };
  })[]
) => {
  const queue = createQueue();

  for (const position of positions) {
    const wallet = await loadWallet(args.wallet, secret);
    const { execute } = await rebalanceMeteoraPosition(
      dex,
      sender,
      fromKeyPairToWalletAdapter(wallet),
      {
        type: "swapless",
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
      dex: "meteora",
      type: "repositioned",
      wallet: {
        id: args.wallet.id,
        user: args.wallet.user,
      },
    });
  }
};
