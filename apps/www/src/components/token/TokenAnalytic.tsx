import clsx from "clsx";
import { useMemo } from "react";

import Decimal from "../Decimal";
import {
  compactCurrencyIntlArgs,
  currencyIntlArgs,
  percentageIntlArgs,
} from "@/constants/format";

type TokenAnalyticProp = {
  timeframe?: string;
  buys: number;
  sells: number;
  traders: number;
  volume24H: number;
  totalSupply: number;
} & React.ComponentProps<"div">;

export default function TokenAnalytic({
  timeframe = "24H",
  buys,
  sells,
  traders,
  totalSupply,
  volume24H,
  ...props
}: TokenAnalyticProp) {
  const netTrades = buys + sells;
  const buysPercentage = netTrades ? (buys / netTrades) * 100 : 0;
  const sellsPercentage = netTrades ? (sells / netTrades) * 100 : 0;

  const percentageIntl = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        ...percentageIntlArgs,
        signDisplay: "never",
      }),
    [],
  );

  return (
    <div
      {...props}
      className={clsx(
        "grid grid-cols-3 gap-2 md:flex md:flex-wrap md:gap-x-4 md:gap-y-2",
        props.className,
      )}
    >
      <div className="flex flex-col md:flex-1">
        <p className="text-xs text-gray md:text-sm">Total Supply</p>
        <Decimal
          value={totalSupply}
          intlArgs={{
            ...compactCurrencyIntlArgs,
            style: undefined,
            currency: undefined,
          }}
        />
      </div>
      <div className="flex flex-col md:flex-1">
        <p className="text-xs text-gray md:text-sm">{timeframe} Vol</p>
        <Decimal
          value={volume24H}
          intlArgs={currencyIntlArgs}
        />
      </div>

      <div className="flex flex-col md:flex-1">
        <p className="text-xs text-gray md:text-sm">{timeframe} Buys</p>
        <p className="text-green-500">
          {percentageIntl.format(buysPercentage)} Buys
        </p>
      </div>
      <div className="flex flex-col md:flex-1">
        <p className="text-xs text-gray md:text-sm">{timeframe} Traders</p>
        <Decimal value={traders} />
      </div>
      <div className="flex flex-col md:flex-1">
        <p className="text-xs text-gray md:text-sm">{timeframe} Net Buyers</p>
        <Decimal value={buys} />
      </div>
      <div className="flex flex-col md:flex-1">
        <p className="text-xs text-gray md:text-sm">{timeframe} Sells</p>
        <p className="text-red-500">
          {percentageIntl.format(sellsPercentage)} Sell
        </p>
      </div>
    </div>
  );
}
