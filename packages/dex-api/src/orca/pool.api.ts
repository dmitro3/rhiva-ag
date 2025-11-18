import { ApiImpl } from "../api-impl";
import type { NormalizedPair } from "../type";
import type { Pair } from "./models/pool.model";
import type { PaginatedMeta, ResponseWithMeta } from "./models/response.model";

type PoolListArgs = {
  sortBy?:
    | "volume"
    | "volume5m"
    | "volume15m"
    | "volume30m"
    | "volume1h"
    | "volume2h"
    | "volume4h"
    | "volume8h"
    | "volume24h"
    | "volume7d"
    | "volume30d"
    | "tvl"
    | "fees"
    | "fees5m"
    | "fees15m"
    | "fees30m"
    | "fees1h"
    | "fees2h"
    | "fees4h"
    | "fees8h"
    | "fees24h"
    | "fees7d"
    | "fees30d"
    | "feesearned"
    | "feesearned5m"
    | "feesearned15m"
    | "feesearned30m"
    | "feesearned1h"
    | "feesearned2h"
    | "feesearned4h"
    | "feesearned8h"
    | "feesearned24h"
    | "feesearned7d"
    | "feesearned30d"
    | "rewards"
    | "rewards5m"
    | "rewards15m"
    | "rewards30m"
    | "rewards1h"
    | "rewards2h"
    | "rewards4h"
    | "rewards8h"
    | "rewards24h"
    | "rewards7d"
    | "rewards30d"
    | "yieldovertvl"
    | "yieldovertvl5m"
    | "yieldovertvl15m"
    | "yieldovertvl30m"
    | "yieldovertvl1h"
    | "yieldovertvl2h"
    | "yieldovertvl4h"
    | "yieldovertvl8h"
    | "yieldovertvl24h"
    | "yieldovertvl7d"
    | "yieldovertvl30d"
    | "lockedliquiditypercent";
  sortDirection?: "asc" | "desc";
  next?: string;
  previous?: string;
  hasRewards?: boolean;
  hasWarning?: boolean;
  hasAdaptiveFee?: boolean;
  isWavebreak?: boolean;
  minTvl?: number;
  minVolume?: number;
  minLockedLiquidityPercentage?: number;
  size?: number;
  token?: string[];
  tokensBothOf?: string[];
  addresses?: string[];
  stats?: (
    | "5m"
    | "15m"
    | "30m"
    | "1h"
    | "2h"
    | "4h"
    | "8h"
    | "24h"
    | "7d"
    | "30d"
  )[];
  includeBlocked?: boolean;
};

export class PoolApi extends ApiImpl {
  path: string = "solana/pools";

  list(args?: PoolListArgs) {
    return ApiImpl.getData(
      this.xior.get<ResponseWithMeta<Pair[], PaginatedMeta>>(
        this.buildPathWithQueryString(this.path, args),
      ),
    );
  }

  search(
    args: Pick<
      PoolListArgs,
      | "next"
      | "size"
      | "sortBy"
      | "sortDirection"
      | "minVolume"
      | "minTvl"
      | "stats"
      | "hasRewards"
    > & {
      userTokens: string[];
      verifiedOnly: boolean;
      hasLockedLiquidity: boolean;
    },
  ) {
    return ApiImpl.getData(
      this.xior.get<ResponseWithMeta<Pair, PaginatedMeta>>(
        this.buildPathWithQueryString(this.buildPath("search"), args),
      ),
    );
  }

  normalize(pool: Pair): NormalizedPair {
    return {
      name: [pool.tokenA.symbol, pool.tokenB.symbol].join("-"),
      address: pool.address,
      binStep: pool.tickSpacing,
      maxFee: 10,
      baseReserveAmount:
        parseFloat(pool.tokenBalanceA) / Math.pow(10, pool.tokenA.decimals),
      quoteReserveAmount:
        parseFloat(pool.tokenBalanceB) / Math.pow(10, pool.tokenB.decimals),
      baseFee: pool.feeRate / 10_000,
      price: parseFloat(pool.price),
      tvl: parseFloat(pool.tvlUsdc),
      liquidity: parseFloat(pool.liquidity),
      fees: parseFloat(pool.stats["30d"].fees),
      fees24H: parseFloat(pool.stats["24h"].fees),
      fees7d: parseFloat(pool.stats["7d"].fees),
      volume24h: parseFloat(pool.stats["24h"].volume),
      apr: parseFloat(pool.yieldOverTvl),
    };
  }
}
