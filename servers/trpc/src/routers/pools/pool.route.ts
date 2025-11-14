import z from "zod";
import moment from "moment";
import { TRPCError } from "@trpc/server";
import { DexApi } from "@rhiva-ag/dex-api";
import type { NonNullable } from "@rhiva-ag/shared";
import type { TradeGetResponse } from "@coingecko/coingecko-typescript/resources/onchain/networks/tokens/trades.js";
import type { OhlcvGetTimeframeResponse } from "@coingecko/coingecko-typescript/resources/onchain/networks/tokens/ohlcv.js";

import { getPools } from "./pool.controller";
import { publicProcedure, router } from "../../trpc";
import {
  poolAnalyticSchema,
  poolChartFilter,
  poolFilterSchema,
  poolSearchSchema,
  poolTradeFilter,
} from "./pool.schema";

export const poolRoute = router({
  list: publicProcedure
    .input(z.union([poolFilterSchema, poolSearchSchema]).optional())
    .query(async ({ ctx, input }) => {
      const key = Buffer.from(JSON.stringify(input), "utf-8").toBase64();
      const cache = await ctx.redis.get(key);
      if (cache)
        return JSON.parse(cache) as NonNullable<
          Awaited<ReturnType<typeof getPools>>
        >;

      const pools = await getPools(ctx.coingecko, input);
      if (pools) {
        await ctx.redis.setex(key, 60, JSON.stringify(pools));
        return pools;
      }

      throw new TRPCError({ code: "NOT_FOUND", message: "pools not found" });
    }),

  chart: publicProcedure
    .input(
      z.object({
        pool_address: z.string(),
        network: poolSearchSchema.shape.network.nonoptional(),
        timeframe: z.enum(["day", "hour", "minute", "second"]),
        filter: poolChartFilter.optional(),
      }),
    )
    .query(async ({ ctx, input: { filter, timeframe, ...input } }) => {
      const response =
        await ctx.coingecko.onchain.networks.pools.ohlcv.getTimeframe(
          timeframe,
          {
            ...input,
            ...filter,
          },
        );

      return {
        base_token: response.meta?.base,
        quote_token: response.meta?.quote,
        ohlcv_list: response.data?.attributes?.ohlcv_list,
      } as NonNullable<OhlcvGetTimeframeResponse.Data["attributes"]> & {
        base_token: NonNullable<OhlcvGetTimeframeResponse.Meta.Base>;
        quote_token: NonNullable<OhlcvGetTimeframeResponse.Meta.Quote>;
      };
    }),
  trades: publicProcedure
    .input(
      z.object({
        pool_address: z.string(),
        network: poolSearchSchema.shape.network.nonoptional(),
        filter: poolTradeFilter.optional(),
      }),
    )
    .query(async ({ ctx, input: { pool_address, ...input } }) => {
      const response = await ctx.coingecko.onchain.networks.pools.trades.get(
        pool_address,
        input,
      );

      return response.data?.map(
        (data) => data.attributes,
      ) as NonNullable<TradeGetResponse.Data.Attributes>[];
    }),
  analytics: publicProcedure
    .output(poolAnalyticSchema)
    .query(async ({ ctx }) => {
      const cacheKey = "pool_analytics";
      const cache = await ctx.redis.get(cacheKey);
      if (cache) return JSON.parse(cache);
      const dexApi = new DexApi();
      const [orcaStat, meteoraStat, raydiumStat, [sarosStat]] =
        await Promise.all([
          dexApi.orca.stat.retrieve(),
          dexApi.meteora.stat.retrieve(),
          dexApi.raydium.stat.retrieve().then(({ data }) => data),
          dexApi.saros.pool
            .chart(moment().startOf("day").toDate().getTime())
            .then(({ data }) => data),
        ]);

      const result = {
        tvl:
          parseFloat(orcaStat.tvl) +
          meteoraStat.total_tvl +
          parseFloat(raydiumStat.tvl) +
          0,
        volume:
          parseFloat(orcaStat.volume24hUsdc) +
          meteoraStat.daily_trade_volume +
          parseFloat(raydiumStat.volume24) +
          (sarosStat ? parseFloat(sarosStat.volume) : 0),
        fees:
          parseFloat(orcaStat.revenue24hUsdc) + meteoraStat.daily_fee + 0 + 0,
      };
      ctx.redis.setex(cacheKey, 60, JSON.stringify(result));
      return result;
    }),
});
