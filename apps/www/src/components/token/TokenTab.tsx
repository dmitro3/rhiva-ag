import clsx from "clsx";
import Link from "next/link";
import { format } from "util";
import { useMemo } from "react";
import type { DexApi } from "@rhiva-ag/dex-api";
import { useSearchParams } from "next/navigation";

import Decimal from "../Decimal";

import { percentageIntlArgs } from "@/constants/format";

type TokenSortProps = {
  data: Pick<
    Awaited<ReturnType<DexApi["jup"]["token"]["list"]>>[number],
    "stats5m" | "stats1h" | "stats6h" | "stats24h"
  >;
} & React.ComponentPropsWithoutRef<"div">;

export default function TokenTab({ data, ...props }: TokenSortProps) {
  const searchParams = useSearchParams();
  const timeframe = searchParams.get("timeframe");

  const tabs = useMemo(() => {
    const tabConfigs = [
      { title: "5M", value: "stats5m", stat: data.stats5m },
      { title: "1H", value: "stats1h", stat: data.stats1h },
      { title: "6H", value: "stats6h", stat: data.stats6h },
      { title: "24H", value: null, stat: data.stats24h },
    ];

    return tabConfigs
      .filter(({ stat }) => stat?.priceChange !== undefined)
      .map(({ title, value, stat }) => ({
        title,
        value,
        priceChange: stat.priceChange,
      }));
  }, [data]);

  return (
    <div
      {...props}
      className={clsx(
        props.className,
        "flex divide-x divide-white/10 border border-white/10 rounded-md overflow-hidden md:max-w-xl",
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.value === timeframe;
        const urlSearchParams = new URLSearchParams(searchParams);
        if (selected || !tab.value) urlSearchParams.delete("timeframe");
        else if (tab.value) urlSearchParams.set("timeframe", tab.value);

        return (
          <Link
            key={tab.value}
            href={format("?%s", urlSearchParams.toString())}
            className={clsx(
              "flex-1 flex items-center space-x-2 px-2 py-1 lt-md:flex-col lg:flex-row",
              tab.priceChange && tab.priceChange > 0
                ? "text-primary"
                : "  text-red-500",
              selected && "bg-primary/20",
            )}
          >
            <span className="text-white">{tab.title}</span>
            {tab.priceChange !== undefined && (
              <Decimal
                as="small"
                disableTruncate
                value={tab.priceChange}
                intlArgs={percentageIntlArgs}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
