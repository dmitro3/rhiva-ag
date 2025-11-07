import Decimal from "decimal.js";
import { PublicKey } from "@solana/web3.js";
import { isNative } from "@rhiva-ag/shared";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

import { useAuth } from "./useAuth";

type Args<T extends number[]> = {
  defaultValue: T;
  mints: { address: string; decimals?: number }[];
};

export const useBalances = <T extends number[]>({
  defaultValue,
  mints,
}: Args<T>) => {
  const { connection } = useConnection();
  const { user, isAuthenticated } = useAuth();

  const { data } = useQuery({
    initialData: defaultValue,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    enabled: isAuthenticated,
    queryKey: ["balance", mints, user?.wallet?.id],
    queryFn: () => {
      return Promise.all(
        mints.map(async ({ address, decimals }) => {
          if (isNative(address)) {
            const balance = await connection
              .getBalance(new PublicKey(user.wallet.id))
              .catch(() => 0);
            return balance / Math.pow(10, 9);
          } else {
            const ata = getAssociatedTokenAddressSync(
              new PublicKey(address),
              new PublicKey(user.wallet.id),
            );
            return await connection
              .getTokenAccountBalance(ata)
              .then(({ value: { uiAmount, amount } }) =>
                uiAmount
                  ? uiAmount
                  : new Decimal(amount)
                      .div(Math.pow(10, decimals || 6))
                      .toNumber(),
              )
              .catch(() => 0);
          }
        }),
      );
    },
  });

  return data;
};
