"use client";
import dynamic from "next/dynamic";
import type { Pair } from "@rhiva-ag/dex-api";
import { useCallback, useMemo, useState } from "react";

import { useTRPCClient } from "@/trpc.client";
import { transformOHLCVToBar } from "./utils";
import type { SearchResultItem } from "./types";
import type { CreateDataFeedArgs } from "./datafeed-trpc";
import type { ResolutionString } from "../../../public/static/charting_library/charting_library";

export type TradingViewPoolChartProps = {
  pool: Pair;
};

const Chart = dynamic(() => import("."));

export default function TradingViewPoolChart({
  pool,
}: TradingViewPoolChartProps) {
  const trpcClient = useTRPCClient();
  const [cachedSearchResults, setCachedSearchResults] = useState<
    Record<string, SearchResultItem>
  >({
    [pool.name]: {
      address: pool.address,
      base_token: {
        name: pool.baseToken.name,
        address: pool.baseToken.id,
        symbol: pool.baseToken.symbol,
        image_url: pool.baseToken.icon,
        decimals: pool.baseToken.decimals,
      },
      quote_token: {
        name: pool.quoteToken.name,
        address: pool.quoteToken.id,
        symbol: pool.quoteToken.symbol,
        image_url: pool.quoteToken.icon,
        decimals: pool.quoteToken.decimals,
      },
    },
  });
  const supportedResolutions = useMemo(
    () =>
      [
        "1",
        "5",
        "15",
        "30",
        "60",
        "240",
        "1D",
        "1W",
        "1M",
      ] as ResolutionString[],
    [],
  );
  const search = useCallback(
    async (
      ...[{ userInput }]: Parameters<
        Exclude<CreateDataFeedArgs["search"], undefined>
      >
    ) => {
      const response = await trpcClient.pool.list.query({
        query: userInput,
      });
      if (response) {
        const results = response?.map((pool) => ({
          address: pool.address,
          dex: {
            id: pool.dex.id,
            type: pool.dex.type,
          },
          base_token: {
            name: pool.base_token.name,
            symbol: pool.base_token.symbol,
            address: pool.base_token.address,
            decimals: pool.base_token.decimals,
            image_url: pool.base_token.image_url,
          },
          quote_token: {
            name: pool.quote_token.name,
            symbol: pool.quote_token.symbol,
            address: pool.quote_token.address,
            decimals: pool.quote_token.decimals,
            image_url: pool.quote_token.image_url,
          },
        }));

        setCachedSearchResults((cache) => ({
          ...cache,
          ...Object.fromEntries(
            results.map((result) => [result.address, result]),
          ),
        }));

        return results;
      }
      return [];
    },
    [trpcClient],
  );

  const getBars = useCallback(
    async (...[args]: Parameters<CreateDataFeedArgs["getBars"]>) => {
      const { ohlcv_list } = await trpcClient.pool.chart.query({
        ...args,
        pool_address: args.address,
      });
      if (ohlcv_list) return ohlcv_list.map(transformOHLCVToBar);
      return [];
    },
    [trpcClient],
  );

  return (
    <Chart
      symbol={pool.name}
      datafeedArgs={{
        getBars,
        search,
        cachedSearchResults,
        defaultConfig: {
          network: "solana",
          supportedResolutions,
        },
      }}
    />
  );
}
