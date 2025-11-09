import { format } from "util";

import { mapResolutionToTimeframe } from "./utils";
import type {
  Aggregrate,
  ChartTimeframe,
  Network,
  SearchResultItem,
  TradingViewDatafeedConfig,
} from "./types";
import type {
  Bar,
  DatafeedConfiguration,
  IBasicDataFeed,
  LibrarySymbolInfo,
  SearchSymbolResultItem,
} from "../../../public/static/charting_library";

export type CreateDataFeedArgs = {
  cachedSearchResults: Record<string, SearchResultItem>;
  getBars: (args: {
    network: Network;
    timeframe: ChartTimeframe;
    address: string;
    type: "token" | "pool";
    filter: {
      limit: number;
      currency: "usd";
      aggregate?: Aggregrate;
      before_timestamp: number;
    };
  }) => Promise<Bar[]>;
  search?: (args: {
    userInput: string;
    exchange?: string;
    symbolType?: string;
  }) => Promise<SearchResultItem[]>;
  defaultConfig: TradingViewDatafeedConfig;
};

export function createDatafeed({
  search,
  getBars,
  cachedSearchResults,
  defaultConfig: { network, supportedResolutions },
}: CreateDataFeedArgs): IBasicDataFeed {
  return {
    onReady: (callback) => {
      setTimeout(() => {
        const configuration: DatafeedConfiguration = {
          supports_marks: false,
          supports_timescale_marks: false,
          supported_resolutions: supportedResolutions,
          symbols_types: [
            { name: "Tokens", value: "token" },
            { name: "Pools", value: "pool" },
          ],
          exchanges: [
            { name: "Orca", value: "orca", desc: "" },
            { name: "Meteora", value: "meteora", desc: "" },
            { name: "Raydium", value: "raydium-clmm", desc: "" },
            { name: "Saros", value: "saros-dlmm", desc: "" },
          ],
        };
        callback(configuration);
      }, 0);
    },
    searchSymbols: (userInput, exchange, symbolType, onResult) => {
      search?.({
        userInput,
        exchange,
        symbolType,
      }).then((response) => {
        const result = response.map(
          ({
            address,
            base_token,
            quote_token,
            dex,
          }): SearchSymbolResultItem => {
            const name = quote_token
              ? format("%s-%s", base_token.name, quote_token.name)
              : base_token.name;
            const ticker = quote_token
              ? format("%s-%s", base_token.symbol, quote_token.symbol)
              : base_token.symbol;
            return {
              ticker,
              type: symbolType,
              description: name,
              exchange: dex ? dex.id : "solana",
              symbol: address ? address : base_token.address,
              logo_urls: quote_token
                ? [base_token.image_url, quote_token.image_url]
                : [base_token.image_url],
            };
          },
        );

        onResult(result);
      });
    },
    resolveSymbol: async (symbolName, onResolve, onError) => {
      let promise: Promise<SearchResultItem[]> | undefined;
      const cachedSearchResult = cachedSearchResults[symbolName];
      if (cachedSearchResult) promise = Promise.resolve([cachedSearchResult]);
      else promise = search?.({ userInput: symbolName });

      promise
        ?.then(
          ([{ quote_token, base_token, dex, address }]): LibrarySymbolInfo => {
            const type = dex ? "pool" : "token";
            const name = quote_token
              ? format("%s-%s", base_token.name, quote_token.name)
              : base_token.name;
            const ticker = quote_token
              ? format("%s-%s", base_token.symbol, quote_token.symbol)
              : base_token.symbol;
            return {
              name,
              ticker,
              type,
              minmov: 1,
              session: "24x7",
              format: "price",
              description: name,
              has_intraday: true,
              volume_precision: 2,
              subsession_id: address ? address : base_token.address, // unsafe
              library_custom_fields: {
                dex,
                address,
                quote_token,
                base_token,
              },
              timezone: "Etc/UTC",
              data_status: "streaming",
              logo_urls: quote_token
                ? [base_token.image_url, quote_token.image_url]
                : [base_token.image_url],
              has_weekly_and_monthly: true,
              exchange: dex ? dex.id : "token",
              listed_exchange: dex ? dex.id : "solana",
              supported_resolutions: supportedResolutions,
              pricescale: Math.pow(
                10,
                Math.max(base_token.decimals, quote_token?.decimals || 0),
              ),
            };
          },
        )
        .then(onResolve)
        .catch(onError);
    },

    getBars: async (
      symbolInfo,
      resolution,
      periodParams,
      onResult,
      onError,
    ) => {
      console.log("[tRPC Datafeed][getBars]: Method call", {
        symbolInfo,
        resolution,
        periodParams,
      });

      const { timeframe, aggregate } = mapResolutionToTimeframe(resolution);
      const { from, to: before_timestamp } = periodParams;

      return getBars({
        network,
        timeframe,
        address: symbolInfo.subsession_id!, // unsafe
        type: symbolInfo.type as "token" | "pool",
        filter: {
          aggregate,
          limit: 100,
          currency: "usd",
          before_timestamp,
        },
      })
        .then((bars) => {
          return bars
            .filter((bar) => {
              const barTime = bar.time / 1000;
              return barTime >= from && barTime <= before_timestamp;
            })
            .sort((a, b) => a.time - b.time);
        })
        .then((bars) => onResult(bars, { noData: bars.length === 0 }))
        .catch(onError);
    },
    subscribeBars: (
      symbolInfo,
      resolution,
      _onTick,
      listenerGuid,
      _onResetCacheNeededCallback,
    ) => {
      // todo: polling for new data
      console.log("[tRPC Datafeed][subscribeBars]: Method call", {
        listenerGuid,
        symbolInfo,
        resolution,
      });
    },
    unsubscribeBars: (listenerGuid) => {
      // todo: polling for new data
      console.log(
        "[tRPC Datafeed][unsubscribeBars]: Method call",
        listenerGuid,
      );
    },
  };
}
