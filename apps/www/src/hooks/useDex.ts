import { useMemo } from "react";
import Dex from "@rhiva-ag/dex/browser";
import { useQuery } from "@tanstack/react-query";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

export const useDex = () => {
  const wallet = useWallet();
  const { connection } = useConnection();

  const { data: raydium } = useQuery({
    queryKey: ["raydium", wallet.publicKey?.toBase58()],
    queryFn: () =>
      Raydium.load({
        connection,
        disableLoadToken: true,
        disableFeatureCheck: true,
        owner: wallet.publicKey ? wallet.publicKey : undefined,
      }),
  });

  const dex = useMemo(
    () => new Dex(connection, raydium),
    [connection, raydium],
  );

  return dex;
};
