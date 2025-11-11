import { ApiImpl } from "../api-impl";
import type { NormalizedPair } from "../type";
import type { Chart } from "./models/chart.model";
import type { Pair, Pool } from "./models/pool.model";
import type { Response } from "./models/response.model";

type PoolListArgs = {
  page?: number;
  size?: number;
  order?: string;
  keyword?: string;
};

export class PoolApi extends ApiImpl {
  path: string = "pool";

  list(args?: PoolListArgs) {
    return ApiImpl.getData(
      this.xior.get<Response<{ data: Pool[]; page: number; total: number }>>(
        this.buildPathWithQueryString(this.path, args),
      ),
    );
  }

  retrieve(id: string) {
    return ApiImpl.getData(this.xior.get<Response<Pair>>(this.buildPath(id)));
  }

  chart(startTime: number = 1747008000000) {
    return ApiImpl.getData(
      this.xior.get<Response<Chart[]>>(
        this.buildPathWithQueryString(this.buildPath("overview/chart"), {
          startTime,
        }),
      ),
    );
  }

  normalize(pool: Pair): NormalizedPair {
    return {
      name: [pool.tokenX.symbol, pool.tokenY.symbol].join("-"),
      address: pool.pair,
      apr: pool.apr24h,
      baseFee: (pool.binStep * pool.baseFactor) / 1e6,
      fees24H: parseFloat(pool.fees24h),
      binStep: pool.binStep,
      maxFee: pool.binStep * pool.baseFactor,
      baseReserveAmount: parseFloat(pool.reserveX),
      quoteReserveAmount: parseFloat(pool.reserveY),
      volume24h: parseFloat(pool.volume24h),
      liquidity: parseFloat(pool.totalLiquidity),
    };
  }

  normalizeToken(token: Pair["tokenX"]) {
    return {
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      icon: token.image,
      tokenProgram: null,
      id: token.mintAddress,
    };
  }
}
