import type Dex from "@rhiva-ag/dex";
import { PublicKey } from "@solana/web3.js";
import { fromLegacyPublicKey } from "@solana/compat";
import { repositionOrcaPosition } from "@rhiva-ag/trpc";
import {
  fromKeyPairToWalletAdapter,
  loadWallet,
  type Secret,
  type KMSSecret,
  type SendTransaction,
} from "@rhiva-ag/shared";

import { Work } from "../../constants";
import { createQueue } from "../shared";
import type { Position } from "../types";

export const repositionOrcaPositions = async (
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
  const queue = createQueue(Work.syncTransaction);

  for (const position of positions) {
    const wallet = await loadWallet(position.wallet, secret);
    const { execute, positionMint } = await repositionOrcaPosition(
      dex,
      sender,
      fromKeyPairToWalletAdapter(wallet),
      {
        type: position.wallet.user.settings.rebalanceType,
        slippage: position.wallet.user.settings.slippage * 100,
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
      dex: "orca",
      type: "repositioned",
      wallet: {
        id: position.wallet.id,
        user: position.wallet.user.id,
      },
      positionMint: fromLegacyPublicKey(positionMint),
    });
  }
};
