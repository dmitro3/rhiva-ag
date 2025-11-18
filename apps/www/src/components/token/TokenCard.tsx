import clsx from "clsx";
import Link from "next/link";
import { format } from "util";
import type { DexApi } from "@rhiva-ag/dex-api";

import Image from "../Image";
import Decimal from "../Decimal";
import CopyButton from "../CopyButton";
import { compactCurrencyIntlArgs } from "@/constants/format";

type TokenCardProps = {
  timestamp?: "5m" | "1h" | "6h" | "24h";
  stat: "stats1h" | "stats24h" | "stats5m" | "stats6h";
  token: Awaited<ReturnType<DexApi["jup"]["token"]["list"]>>[number];
};

export default function TokenCard({
  stat,
  token,
  timestamp = "24h",
}: TokenCardProps) {
  return (
    <Link
      key={token.id}
      href={format("/tokens/%s/", token.id)}
      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-dark p-4 overflow-hidden"
    >
      <Image
        width={64}
        height={64}
        unoptimized
        src={token.icon}
        alt={token.symbol}
        className="size-12 rounded-md shrink-0"
        errorProps={{ className: "size-12 bg-gray/50 rounded-md" }}
      />

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-base md:text-lg font-medium">
              {token.name}
            </p>
            <CopyButton
              type="button"
              content={token.id}
              className="shrink-0 text-gray"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span>Risk</span>
            <span
              className={clsx(
                "size-2 rounded-full",
                token.isVerified ? "bg-primary" : "bg-red-500",
              )}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <p className="whitespace-nowrap text-gray/80">
            <span className="text-gray">Mcap: </span>
            <Decimal
              value={token.mcap}
              intlArgs={compactCurrencyIntlArgs}
            />
          </p>
          <p className="whitespace-nowrap">
            <span>
              <span>{timestamp}</span> Vol:&nbsp;
            </span>
            <Decimal
              value={
                token[stat]?.buyOrganicVolume ||
                token[stat]?.sellOrganicVolume ||
                0
              }
              intlArgs={compactCurrencyIntlArgs}
            />
          </p>
        </div>
      </div>
    </Link>
  );
}
