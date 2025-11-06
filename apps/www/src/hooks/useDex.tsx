import { useMemo } from "react";
import Dex from "@rhiva-ag/dex";
import { useQuery } from "@tanstack/react-query";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { useConnection } from "@solana/wallet-adapter-react";

export const useDex = () => {
  const { connection } = useConnection();
  const { data: raydium } = useQuery({
    queryKey: ["raydium"],
    queryFn: () =>
      Raydium.load({
        connection,
        disableLoadToken: true,
        disableFeatureCheck: true,
      }),
  });

  const dex = useMemo(
    () => new Dex(connection, raydium),
    [connection, raydium],
  );

  return dex;
};
