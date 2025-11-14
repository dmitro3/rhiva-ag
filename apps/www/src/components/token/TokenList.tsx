import clsx from "clsx";
import Link from "next/link";
import { format } from "util";
import { useMemo } from "react";
import type { DexApi } from "@rhiva-ag/dex-api";

import Image from "../Image";
import Decimal from "../Decimal";
import TokenCard from "./TokenCard";
import CopyButton from "../CopyButton";
import { compactCurrencyIntlArgs } from "@/constants/format";

type TokenListProps = {
  timestamp?: "5m" | "1h" | "6h" | "24h";
  tokens: Awaited<ReturnType<DexApi["jup"]["token"]["list"]>>;
};
export default function TokenList(props: TokenListProps) {
  return (
    <>
      <div className="flex flex-wrap gap-4 lt-sm:hidden sm:grid sm:grid-cols-[repeat(auto-fit,minmax(320px,2fr))]">
        {props.tokens.map((token) => (
          <TokenCard
            key={token.id}
            token={token}
            timestamp={props.timestamp}
          />
        ))}
      </div>
      <TokenListSmall {...props} />
    </>
  );
}

function TokenListSmall({ timestamp = "24h", tokens }: TokenListProps) {
  const stats = useMemo(
    () =>
      ({
        "5m": "stats5m",
        "1h": "stats1h",
        "6h": "stats6h",
        "24h": "stats24h",
      }) as const,
    [],
  );
  const stat = useMemo(() => stats[timestamp], [stats, timestamp]);

  return (
    <table className="sm:hidden">
      <thead>
        <tr className="text-gray text-sm/8">
          <td>#</td>
          <td>Tokens</td>
          <td>Mcap</td>
          <td>
            <span className="uppercase">{timestamp}</span> Vol
          </td>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/10">
        {tokens.map((token, index) => {
          return (
            <tr key={token.id}>
              <td>{index + 1}</td>
              <td>
                <Link
                  href={format("/tokens/%s", token.id)}
                  className="flex space-x-1 items-center"
                >
                  <Image
                    src={token.icon}
                    width={32}
                    height={32}
                    alt={token.symbol}
                    className="size-8 rounded-full"
                  />
                  <span>{token.symbol}</span>
                  <CopyButton content={token.id} />
                  <div
                    className={clsx(
                      "size-2 rounded-full",
                      token.isVerified ? "bg-primary" : "bg-red-500",
                    )}
                  />
                </Link>
              </td>
              <td>
                <Decimal
                  value={token.mcap}
                  intlArgs={compactCurrencyIntlArgs}
                />
              </td>
              <td>
                <Decimal
                  intlArgs={compactCurrencyIntlArgs}
                  value={
                    token[stat].buyOrganicVolume + token[stat].sellOrganicVolume
                  }
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
