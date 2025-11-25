import clsx from "clsx";
import Link from "next/link";
import { format } from "util";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@rhiva-ag/auth-ui/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Decimal from "../Decimal";
import { getNumberColor } from "@/lib";
import { useTRPC } from "@/trpc.client";
import { useCurrencies } from "@/hooks/useCurrency";
import type { getWalletPNL } from "@/lib/get-tokens";
import { currencyIntlArgs, percentageIntlArgs } from "@/constants/format";

export default function PortfolioInfo(props: React.ComponentProps<"div">) {
  const trpc = useTRPC();
  const { user } = useAuth();
  const currencies = useCurrencies();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { data } = useQuery(trpc.position.aggregrate.queryOptions());

  const currency = useMemo(() => searchParams.get("currency"), [searchParams]);

  const token = useMemo(
    () =>
      queryClient.getQueryData<Awaited<ReturnType<typeof getWalletPNL>>>([
        "wallet",
        "tokens",
        user.wallet.id,
      ]),
    [user, queryClient],
  );

  const winRate = useMemo(() => {
    if (!data) return 0;
    const { profitUsd = 0, lossUsd = 0 } = data;
    const total = profitUsd + lossUsd;
    if (total === 0) return 0;
    return (profitUsd / total) * 100;
  }, [data]);

  return (
    data && (
      <div
        {...props}
        className={clsx("flex flex-col space-y-4", props.className)}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <p className="text-gray uppercase">Total Net Worth</p>
            <Decimal
              disableTruncate
              value={data.networthUsd + (token?.summary?.balance || 0)}
              intlArgs={currencyIntlArgs}
              className="text-2xl font-semibold"
            />
          </div>
          <div className="flex items-center border border-white/10 divide-x divide-white/10 rounded overflow-hidden">
            {currencies.map(({ label, value }) => {
              const selected = value === currency;
              const urlSearchParams = new URLSearchParams(searchParams);
              if (selected) urlSearchParams.delete("currency");
              else if (value) urlSearchParams.set("currency", value);
              else urlSearchParams.delete("currency");

              return (
                <Link
                  key={value}
                  href={format("?%s", urlSearchParams.toString())}
                  className={clsx("px-2", selected && "bg-primary text-black")}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 sm:grid-cols-2">
          <div className="flex flex-col">
            <p className="text-gray uppercase lt-sm:text-xs">Total Closed</p>
            <Decimal
              value={data.closed}
              className="text-base font-medium"
            />
          </div>
          <div className="flex flex-col">
            <p className="text-gray uppercase lt-sm:text-xs">Avg Invested</p>
            <Decimal
              value={data.avgInvestedUsd}
              intlArgs={currencyIntlArgs}
              className="text-base font-medium"
            />
          </div>
          <div className="flex flex-col">
            <p className="text-gray uppercase lt-sm:text-xs">Total Profit</p>
            <Decimal
              value={data.profitUsd}
              intlArgs={currencyIntlArgs}
              className="text-base font-medium"
            />
          </div>
          <div className="flex flex-col">
            <p className="text-gray uppercase lt-sm:text-xs">Total Loss</p>
            <Decimal
              value={data.lossUsd}
              intlArgs={currencyIntlArgs}
              className={clsx(
                "text-base font-medium",
                data.lossUsd < 0 && "text-red-500",
              )}
            />
          </div>
          <div className="flex flex-col">
            <p className="text-gray uppercase lt-sm:text-xs">Win rate</p>
            <Decimal
              value={winRate}
              intlArgs={percentageIntlArgs}
              className={clsx("text-base font-medium", getNumberColor(winRate))}
            />
          </div>
          <div className="flex flex-col">
            <p className="text-gray uppercase lt-sm:text-xs">Fee Earned</p>
            <Decimal
              value={data.feeUsd}
              intlArgs={currencyIntlArgs}
              className="text-base font-medium"
            />
          </div>
          <div className="flex flex-col">
            <p className="text-nowrap text-gray uppercase lt-sm:text-xs">
              Avg monthly profit
            </p>
            <Decimal
              value={data.avgMonthlyProfit}
              intlArgs={{
                ...currencyIntlArgs,
                maximumFractionDigits: 6,
              }}
              className={clsx(
                "text-base font-medium",
                getNumberColor(data.avgMonthlyProfit),
              )}
            />
          </div>
        </div>
      </div>
    )
  );
}
