import type z from "zod/v3";
import Link from "next/link";
import { format } from "util";
import { useMemo } from "react";
import { MdOpenInNew } from "react-icons/md";
import type { NonNullable } from "@rhiva-ag/shared";
import type { agentOutputSchema } from "@rhiva-ag/mcp";

import Image from "@/components/Image";
import IcDex from "@/assets/icons/ic_dex";
import BarProgress from "@/components/BarProgress";
import { currencyIntlArgs, percentageIntlArgs } from "@/constants/format";

type PoolCardProps = {
  pool: NonNullable<z.infer<typeof agentOutputSchema>["pools"]>[number];
};

export function PoolCard({ pool }: PoolCardProps) {
  const currencyIntl = useMemo(
    () => new Intl.NumberFormat("en-US", currencyIntlArgs),
    [],
  );
  const percentageIntl = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        ...percentageIntlArgs,
        signDisplay: "never",
      }),
    [],
  );

  return (
    <div className="min-w-sm flex flex-col space-y-2 bg-white/10 rounded-xl p-4">
      <div className="flex items-center">
        <div className="flex-1 flex items-center space-x-2">
          <div className="flex items-center">
            <Image
              src={pool.baseToken?.imageUrl}
              width={24}
              height={24}
              alt={pool.baseToken?.name}
              className="rounded-full"
            />
            <Image
              src={pool.quoteToken?.imageUrl}
              width={24}
              height={24}
              alt={pool.quoteToken?.name}
              className="-ml-2 rounded-full"
            />
          </div>
          <p className="text-lg font-medium">{pool.name.replace(" / ", "-")}</p>
          <IcDex
            dex={pool.dex.id}
            width={16}
            height={16}
          />
        </div>
        <div className="flex items-center space-x-2 border border-white/10 px-2 py-0.5 rounded">
          <span className="text-gray">Risk</span>
          <BarProgress value={pool.analysis.riskScore} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="uppercase text-gray">Suggested Range</p>
          <p className="font-bold">
            -{percentageIntl.format(pool.analysis.priceRange[0])}, +
            {percentageIntl.format(pool.analysis.priceRange[1])}
          </p>
        </div>
        <div className="text-end">
          <p className="uppercase text-gray">Confidence</p>
          <p className="font-bold">
            {percentageIntl.format(pool.analysis.confidence)}
          </p>
        </div>
        <div>
          <p className="uppercase text-gray">Strategy</p>
          <p className="font-bold">{pool.analysis.suggestedStrategy}</p>
        </div>
        <div className="text-end">
          <p className="uppercase text-gray">Suggested Deposit</p>
          <p className="font-bold">
            {currencyIntl.format(pool.analysis.suggestedDeposit)}
          </p>
        </div>
        <div>
          <p className="uppercase text-gray text-nowrap">
            Estimated Earn Per Day
          </p>
          <p className="font-bold">
            <span className="text-primary">
              {currencyIntl.format(
                pool.analysis.suggestedDeposit *
                  pool.analysis.estimatedEarnPerDay,
              )}
            </span>
            &nbsp;
            {percentageIntl.format(pool.analysis.estimatedEarnPerDay * 100)}
          </p>
        </div>
      </div>
      <Link
        href={format("/pools/%s/%s/", pool.dex.id, pool.address)}
        target="_blank"
        className="flex items-center justify-center bg-primary text-black px-4 py-2 rounded"
      >
        <span className="flex-1 text-center">Open Position</span>
        <MdOpenInNew size={18} />
      </Link>
    </div>
  );
}
