import clsx from "clsx";
import { useMemo, useState } from "react";

import Image from "../Image";
import Decimal from "../Decimal";
import type { getWalletPNL } from "@/lib/get-tokens";
import { currencyIntlArgs, percentageIntlArgs } from "@/constants/format";

type PortfolioTokenListProps = {
  tokens: Awaited<ReturnType<typeof getWalletPNL>>["tokens"];
};

export default function PortfolioTokenList({
  tokens,
}: PortfolioTokenListProps) {
  const [hideZeroBalance, setHideZeroBalance] = useState(true);
  const percentageIntl = useMemo(
    () => new Intl.NumberFormat("en-US", percentageIntlArgs),
    [],
  );

  const filterTokens = useMemo(
    () =>
      hideZeroBalance ? tokens.filter((token) => token.balance !== 0) : tokens,
    [hideZeroBalance, tokens],
  );

  return (
    <div className="flex-1 flex flex-col space-y-4 border border-white/20 rounded">
      <div className="flex items-center justify-between p-3">
        <p className="text-base font-semibold">Tokens</p>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            className="accent-primary"
            checked={hideZeroBalance}
            onChange={(event) => setHideZeroBalance(event.target.checked)}
          />
          <span className="text-sm lg:text-base">Hide zero balance</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 p-2 border-b border-white/10">
        <div className="text-gray text-sm font-medium">TOKEN NAME</div>
        <div className="text-gray text-sm font-medium text-center lt-sm:hidden">
          PRICE/24H CHANGE
        </div>
        <div className="text-gray text-sm font-medium text-right">BALANCE</div>
      </div>

      <div className="flex flex-col space-y-2 lg:space-y-0">
        {filterTokens.map((token) => (
          <div
            key={token.id}
            className={clsx(
              "flex items-center justify-between p-3",
              "lg:grid lg:grid-cols-3 lg:gap-4 lg:py-3 lg:border-none lg:rounded-none lg:bg-transparent lg:border-b lg:border-white/5 lg:last:border-b-0",
            )}
          >
            <div className="flex items-center space-x-3">
              <Image
                src={token.icon}
                width={36}
                height={36}
                alt={token.symbol}
                className="rounded-full lg:w-10 lg:h-10"
              />
              <div className="flex flex-col">
                <p className="text-base font-medium">{token.name}</p>
                <div className="flex items-center space-x-2 lg:hidden">
                  <Decimal
                    value={token.usdPrice}
                    intlArgs={currencyIntlArgs}
                    className="text-gray text-sm"
                  />
                  <p
                    className={clsx(
                      "text-sm font-semibold",
                      token.stats24h.priceChange < 0
                        ? "text-red-500"
                        : "text-green-500",
                    )}
                  >
                    {percentageIntl.format(token.stats24h.priceChange)}
                  </p>
                </div>
                <p className="hidden lg:block text-gray text-sm">
                  {token.symbol}
                </p>
              </div>
            </div>

            <div className="hidden lg:flex lg:flex-col lg:items-center lg:justify-center">
              <Decimal
                value={token.usdPrice}
                intlArgs={currencyIntlArgs}
                className="text-base font-medium"
              />
              <p
                className={clsx(
                  "text-sm font-semibold",
                  token.stats24h.priceChange < 0
                    ? "text-red-500"
                    : "text-green-500",
                )}
              >
                {percentageIntl.format(token.stats24h.priceChange)}
              </p>
            </div>

            <div className="text-right lg:flex lg:flex-col lg:items-end lg:justify-center">
              <Decimal
                value={token.balance * token.usdPrice}
                intlArgs={currencyIntlArgs}
                minValue={0.01}
                className="text-base font-medium"
              />
              <p className="text-gray text-sm">
                <Decimal value={token.balance} /> {token.symbol}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
