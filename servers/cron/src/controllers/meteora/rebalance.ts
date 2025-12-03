import type Dex from "@rhiva-ag/dex";
import { PublicKey } from "@solana/web3.js";
import { rebalanceMeteoraPosition } from "@rhiva-ag/trpc";
import {
  fromKeyPairToWalletAdapter,
  loadWallet,
  type Secret,
  type KMSSecret,
  type SendTransaction,
} from "@rhiva-ag/shared";

import { Work } from "../../constants";
import type { Position } from "../types";
import { createQueue } from "../../../../trpc/src/routers/positions/shared";

export const rebalanceMeteoraPositions = async (
  {
    dex,
    sender,
    secret,
  }: {
    dex: Dex;
    sender: SendTransaction;
    secret: KMSSecret | Secret;
  },
  ...positions: Position[]
) => {
  const queue = createQueue();

  for (const position of positions) {
    const wallet = await loadWallet(position.wallet, secret);
    const { execute } = await rebalanceMeteoraPosition(
      dex,
      sender,
      fromKeyPairToWalletAdapter(wallet),
      {
        type: "swapless",
        pair: new PublicKey(position.pool.id),
        position: new PublicKey(position.id),
        slippage: position.wallet.user.settings.slippage * 100,
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
      type: "rebalanced-position",
      wallet: {
        id: position.wallet.id,
        user: position.wallet.user.id,
      },
    });
  }
};
