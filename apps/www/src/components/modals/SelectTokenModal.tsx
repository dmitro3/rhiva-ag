import clsx from "clsx";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@rhiva-ag/auth-ui/client";
import { MdClose, MdVerified } from "react-icons/md";
import { useConnection } from "@solana/wallet-adapter-react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

import Image from "../Image";
import { dexApi } from "@/instances";
import { truncateString } from "@/lib";
import SearchInput from "../SearchInput";
import { getWalletPNL } from "@/lib/get-tokens";

export type Token = {
  icon: string;
  name: string;
  symbol: string;
  mint: string;
  decimals: number;
  verified: boolean;
  balance: number;
};

type SelectTokenModalProps = {
  value: Token;
  onChange: (value: Token) => void;
} & React.ComponentProps<typeof Dialog>;

export default function SelectTokenModal({
  value,
  onChange,
  ...props
}: SelectTokenModalProps) {
  const { user } = useAuth();
  const { connection } = useConnection();
  const [tokenArgs, setTokenArgs] = useState<
    Parameters<typeof dexApi.jup.token.list>[number]
  >({
    timestamp: "5m",
    category: "toptraded",
  });

  const { data: walletPNL } = useQuery({
    enabled: Boolean(user),
    queryKey: ["wallet", "tokens", user?.wallet?.id],
    queryFn: async () => getWalletPNL(connection, dexApi, user?.wallet?.id),
  });

  const { data } = useQuery({
    queryKey: ["tokens", tokenArgs.category, tokenArgs.query, tokenArgs.query],
    queryFn: () => dexApi.jup.token.list(tokenArgs),
  });

  const tokens: Token[] = useMemo(() => {
    if (data) {
      const added = new Map<string, Token>();
      for (const token of [...(walletPNL ? walletPNL.tokens : []), ...data]) {
        const _token = added.get(token.id);

        if (_token && !("balance" in token)) continue;

        added.set(token.id, {
          mint: token.id,
          icon: token.icon,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
          verified: token.isVerified,
          balance: "balance" in token ? (token.balance as number) : 0,
        });
      }

      return added.values().toArray();
    }

    if (walletPNL)
      return walletPNL?.tokens.map((token) => ({
        mint: token.id,

        icon: token.icon,
        name: token.name,
        symbol: token.symbol,
        balance: token.balance,
        decimals: token.decimals,

        verified: token.isVerified,
      }));

    return [];
  }, [data, walletPNL]);

  return (
    <Dialog
      {...props}
      className={clsx("relative z-50", props.className)}
    >
      <div className="fixed inset-0 flex flex-col">
        <DialogBackdrop className="absolute inset-0 bg-black/50 -z-10" />
        <DialogPanel className="m-auto flex flex-col space-y-4 bg-dark px-4 z-10 max-w-9/10 max-h-xl md:min-w-xl md:min-h-xl">
          <div className="flex flex-col space-y-4 py-4">
            <header className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold md:text-2xl">
                Select Token
              </DialogTitle>
              <button
                type="submit"
                onClick={() => props.onClose?.(false)}
              >
                <MdClose size={18} />
              </button>
            </header>
            <SearchInput
              placeholder="Search by name, symbol or address..."
              onChange={(value) => {
                if (value) setTokenArgs({ category: "search", query: value });
                else setTokenArgs({ category: "toptraded", timestamp: "5m" });
              }}
            />
          </div>
          <div className="flex flex-col overflow-y-scroll">
            <div className="flex flex-col space-y-2">
              <p className="text-gray">Tokens</p>
              <div className="flex flex-col space-y-1">
                {tokens.map((token) => {
                  const selected = token.mint === value.mint;

                  return (
                    <button
                      key={token.mint}
                      type="button"
                      className={clsx(
                        "flex items-center space-x-4 p-2 hover:bg-white/3 rounded-xl",
                        selected && "bg-white/3",
                      )}
                      onClick={() => {
                        onChange(token);
                        props.onClose(false);
                      }}
                    >
                      <Image
                        src={token.icon}
                        width={32}
                        height={32}
                        alt={token.symbol}
                        className="size-8 rounded-full"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="text-base font-medium max-w-7/10 truncate">
                            {token.name}
                          </p>
                          <MdVerified size={16} />
                        </div>
                        <div className="flex items-center space-x-2">
                          <p className="text-white/75">{token.symbol}</p>
                          <p className=" text-gray">.</p>
                          <p className="text-xs text-white/50">
                            {truncateString(token.mint)}
                          </p>
                        </div>
                      </div>
                      <p className="text-white/75">Balance: {token.balance}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
