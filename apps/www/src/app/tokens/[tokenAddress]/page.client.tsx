"use client";
import moment from "moment";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { dexApi } from "@/instances";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/layout/Header";
import { DefaultToken } from "@/constants/tokens";
import TokenSort from "@/components/token/TokenTab";
import SwapModal from "@/components/modals/SwapModal";
import TokenInfo from "@/components/token/TokenInfo";
import TokenAnalytic from "@/components/token/TokenAnalytic";
import TokenMetadata from "@/components/token/TokenMetadata";
import TradingViewTokenChart from "@/components/TradingViewChart/TradingViewTokenChart";

export const TimeFrame = {
  stats5m: "5M",
  stats1h: "1H",
  stats6h: "6H",
  stats24h: "24H",
} as const;

type TokenPageProps = {
  params: { tokenAddress: string };
  searchParams: { timeframe: keyof typeof TimeFrame };
};

export default function TokenPage({
  params: { tokenAddress },
  searchParams: { timeframe },
}: TokenPageProps) {
  const { signIn, isAuthenticated } = useAuth();
  const [showSwapModal, setShowSwapModal] = useState(false);

  const { data } = useQuery({
    queryKey: ["tokens", tokenAddress],
    queryFn: () =>
      dexApi.jup.token.list({
        category: "search",
        query: tokenAddress,
      }),
  });

  if (data && data.length > 0) {
    const [token] = data;
    let stat = token[timeframe];
    stat = stat ? stat : token.stats24h;

    return (
      <div className="flex-1 flex flex-col overflow-y-scroll lt-sm:fixed lt-sm:inset-0 lt-md:z-50 lt-sm:bg-dark">
        <Header
          canBack
          className="sticky top-0 z-10"
        />
        <div className="flex-1 flex flex-col space-y-4 overflow-y-scroll px-4 py-4 md:grid md:gap-16 md:grid-cols-2">
          <div className="lt-md:flex-1 flex flex-col space-y-4">
            <div className="grid gap-4 md:grid-cols-2 md:items-start">
              <TokenMetadata
                mint={token.id}
                name={token.name}
                symbol={token.symbol}
                image={token.icon}
                createdTime={moment(token.firstPool.createdAt)}
                className="md:order-1 md:grid-span-1"
              />
              <TokenInfo
                mint={token.id}
                liquidity={token.liquidity}
                marketCap={token.mcap}
                volume={
                  token.stats24h.sellOrganicVolume +
                  token.stats24h.buyOrganicVolume
                }
                price={token.usdPrice}
                holders={token.holderCount}
                className="md:order-3 md:col-span-2"
              />
              <TokenSort
                className="md:order-2 md:col-span-2 xl:col-span-1"
                data={token}
              />
              {stat && (
                <TokenAnalytic
                  buys={stat.numBuys}
                  sells={stat.numSells}
                  traders={stat.numTraders}
                  totalSupply={token.totalSupply}
                  timeframe={TimeFrame[timeframe] ?? "24H"}
                  volume24H={stat.buyOrganicVolume + stat.sellOrganicVolume}
                  className="md:order-3 md-col-span-2"
                />
              )}
            </div>
            <div className="flex-1 flex flex-col min-h-md">
              <TradingViewTokenChart token={token} />
            </div>
          </div>
          <div className="flex flex-col xl:flex xl:items-center">
            <SwapModal
              open={showSwapModal}
              tokens={[
                DefaultToken.Sol,
                {
                  balance: 0,
                  mint: token.id,
                  icon: token.icon,
                  name: token.name,
                  symbol: token.symbol,
                  decimals: token.decimals,
                  verified: token.isVerified,
                },
              ]}
              onClose={() => setShowSwapModal(false)}
            />
            <button
              type="button"
              className="bg-primary text-black px-2 py-3 rounded md:hidden"
              onClick={() => {
                if (isAuthenticated) return setShowSwapModal(true);
                signIn();
              }}
            >
              Swap
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
