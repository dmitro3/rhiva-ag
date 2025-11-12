"use client";
import dynamic from "next/dynamic";
import { memo, useCallback, useMemo, useState } from "react";
import type { Token } from "@rhiva-ag/dex-api/jup/types";

import { dexApi } from "@/instances";
import { useTRPCClient } from "@/trpc.client";
import { transformOHLCVToBar } from "./utils";
import type { SearchResultItem } from "./types";
import type { CreateDataFeedArgs } from "./datafeed-trpc";
import type { ResolutionString } from "../../../public/static/charting_library/charting_library";

export type TradingViewtokenChartProps = {
  token: Token;
};

const Chart = dynamic(() => import("."));
export default memo(function TradingViewtokenChart({
  token,
}: TradingViewtokenChartProps) {
  const trpcClient = useTRPCClient();
  const [cachedSearchResults, setCachedSearchResults] = useState<
    Record<string, SearchResultItem>
  >({
    [token.name]: {
      address: token.id,
      base_token: {
        name: token.name,
        address: token.id,
        symbol: token.symbol,
        image_url: token.icon,
        decimals: token.decimals,
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
      const response = await dexApi.jup.token.list({
        category: "search",
        query: userInput,
      });
      if (response) {
        const results = response?.map((token) => ({
          address: token.id,

          base_token: {
            name: token.name,
            address: token.id,
            symbol: token.symbol,
            image_url: token.icon,
            decimals: token.decimals,
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
    [],
  );

  const getBars = useCallback(
    async (...[args]: Parameters<CreateDataFeedArgs["getBars"]>) => {
      const { ohlcv_list } = await trpcClient.token.chart.query({
        ...args,
        token_address: args.address,
      });
      if (ohlcv_list) return ohlcv_list.map(transformOHLCVToBar);
      return [];
    },
    [trpcClient],
  );

  return (
    <Chart
      symbol={token.name}
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
});
