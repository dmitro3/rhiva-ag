import type z from "zod/v3";
import Link from "next/link";
import { format } from "util";
import { useMemo } from "react";
import { MdOpenInNew } from "react-icons/md";
import type { NonNullable } from "@rhiva-ag/shared";
import type { agentOutputSchema } from "@rhiva-ag/mcp";

import Image from "@/components/Image";
import BarProgress from "@/components/BarProgress";
import { currencyIntlArgs, percentageIntlArgs } from "@/constants/format";

type TokenCardProps = {
  token: NonNullable<z.infer<typeof agentOutputSchema>["tokens"]>[number];
};

export function TokenCard({ token }: TokenCardProps) {
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
          <Image
            width={24}
            height={24}
            src={token.image}
            alt={token.name}
            className="rounded-full"
          />
          <p className="text-lg font-medium">{token.name}</p>
        </div>
        <div className="flex items-center space-x-2 border border-white/10 px-2 py-0.5 rounded">
          <span className="text-gray">Risk</span>
          <BarProgress value={token.analysis.riskScore} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="uppercase text-gray">Confidence</p>
          <p className="font-bold">
            {percentageIntl.format(token.analysis.confidence)}
          </p>
        </div>

        <div className="text-end">
          <p className="uppercase text-gray">Suggested Deposit</p>
          <p className="font-bold">
            {currencyIntl.format(token.analysis.suggestedDeposit)}
          </p>
        </div>
        <div>
          <p className="uppercase text-gray text-nowrap">
            Estimated Earn Per Day
          </p>
          <p className="font-bold">
            <span className="text-primary">
              {currencyIntl.format(
                token.analysis.suggestedDeposit *
                  token.analysis.estimatedEarnPerDay,
              )}
            </span>
            &nbsp;
            {percentageIntl.format(token.analysis.estimatedEarnPerDay * 100)}
          </p>
        </div>
      </div>
      <Link
        href={format("/tokens/%s/", token.address)}
        target="_blank"
        className="flex items-center justify-center bg-primary text-black px-4 py-2 rounded"
      >
        <span className="flex-1 text-center">Open Token</span>
        <MdOpenInNew size={18} />
      </Link>
    </div>
  );
}
