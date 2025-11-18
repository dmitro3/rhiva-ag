import { ApiImpl } from "../api-impl";
import type { NormalizedPair } from "../type";
import type { Pair } from "./models/pool.model";
import type { PaginatedResponse, Response } from "./models/response.model";

type LegacyPoolListArgs = {
  mint1?: string;
  mint2?: string;
  size?: number;
  mintFilter?: string;
  nextPageId?: number;
  hasReward?: boolean;
  sortType?: "desc" | "asc";
  poolType:
    | "all"
    | "concentrated"
    | "standard"
    | "allFarm"
    | "concentratedFarm"
    | "standardFarm";
  sortField?:
    | "liquidity"
    | "volume24h"
    | "fee24h"
    | "apr24h"
    | "volume30d"
    | "fee30d"
    | "apr30d";
};

type PoolListArgs = Pick<LegacyPoolListArgs, "poolType" | "sortType"> & {
  pageSize: number;
  page: number;
  poolSortField: Exclude<LegacyPoolListArgs["sortField"], undefined>;
};

export class PoolApi extends ApiImpl {
  path: string = "pools";

  ids(...ids: string[]) {
    return ApiImpl.getData(
      this.xior.get<Response<Pair[]>>(
        this.buildPathWithQueryString(this.buildPath("info/ids"), {
          ids: ids.join(","),
        }),
      ),
    );
  }
  lps(...lpss: string[]) {
    return ApiImpl.getData(
      this.xior.get<Response<Pair[]>>(
        this.buildPathWithQueryString(this.buildPath("info/ids"), {
          ids: lpss.join(","),
        }),
      ),
    );
  }

  mint(
    args: Pick<LegacyPoolListArgs, "mint2"> & PoolListArgs & { mint1: string },
  ) {
    return ApiImpl.getData(
      this.xior.get<PaginatedResponse<Pair>>(
        this.buildPathWithQueryString(this.buildPath("info/mint"), args),
      ),
    );
  }

  list(args?: PoolListArgs) {
    return ApiImpl.getData(
      this.xior.get<PaginatedResponse<Pair>>(
        this.buildPathWithQueryString(this.buildPath("info/list"), args),
      ),
    );
  }
  listV2(args?: LegacyPoolListArgs & { size: number }) {
    return ApiImpl.getData(
      this.xior.get<Response<{ data: Pair[]; nextPageId: string }>>(
        this.buildPathWithQueryString(this.buildPath("info/list-v2"), args),
      ),
    );
  }

  normalize(
    pool: Pair,
    mintAPriceUsd: number,
    mintBPriceUsd: number,
  ): NormalizedPair {
    const apr = pool.day.apr;
    const feeApr = pool.day.feeApr;
    const rewardAprs = pool.day.rewardApr;

    const dailyFeeYieldPct = feeApr / 100 / 365;
    const dailyRewardYieldPct = rewardAprs.reduce(
      (acc, cur) => acc + cur / 100 / 265,
      0,
    );
    const dailyYieldPct =
      apr / 100 / 365 || dailyFeeYieldPct + dailyRewardYieldPct;

    return {
      address: pool.id,
      name: [pool.mintA.symbol, pool.mintB.symbol].join("-"),
      baseReserveAmount: pool.mintAmountA,
      quoteReserveAmount: pool.mintAmountB,
      price: pool.price,
      apr: dailyYieldPct,
      baseFee: pool.config.tradeFeeRate / 10_000,
      tvl: parseFloat(pool.tvl),
      fees: pool.month.volumeFee,
      fees24H: pool.day.volumeFee,
      fees7d: pool.week.volumeFee,
      binStep: pool.config.tickSpacing,
      maxFee:
        (pool.config.tradeFeeRate +
          pool.config.protocolFeeRate +
          pool.config.fundFeeRate) /
        1e6,
      volume24h: pool.day.volume,
      liquidity:
        mintAPriceUsd * pool.mintAmountA + mintBPriceUsd * pool.mintAmountB,
    };
  }
}
