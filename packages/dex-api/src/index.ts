import { collectionToMap } from "@rhiva-ag/shared";

import { JupApi } from "./jup";
import { OrcaApi } from "./orca";
import { SarosApi } from "./saros";
import { MeteoraApi } from "./meteora";
import { RaydiumApi } from "./raydium";
import type { ApiConfig, Pair } from "./type";

export { type Pair, SarosApi, MeteoraApi };

export class DexApi {
  readonly jup: JupApi;
  readonly orca: OrcaApi;
  readonly saros: SarosApi;
  readonly raydium: RaydiumApi;
  readonly meteora: MeteoraApi;

  static defaultConfig: Record<
    | "orcaApiConfig"
    | "jupApiConfig"
    | "meteoraApiConfig"
    | "raydiumApiConfig"
    | "sarosApiConfig",
    ApiConfig
  > = {
    orcaApiConfig: {
      baseURL: "https://api.orca.so/v2",
    },
    jupApiConfig: {
      baseURL: "https://lite-api.jup.ag",
    },
    meteoraApiConfig: {
      baseURL: "https://dlmm-api.meteora.ag",
    },
    raydiumApiConfig: {
      baseURL: "https://api-v3.raydium.io",
    },
    sarosApiConfig: {
      baseURL: "https://api.saros.xyz/api/dex-v3",
    },
  };

  constructor(config?: {
    jupApiConfig?: ApiConfig;
    orcaApiConfig?: ApiConfig;
    sarosApiConfig?: ApiConfig;
    raydiumApiConfig?: ApiConfig;
    meteoraApiConfig?: ApiConfig;
  }) {
    const {
      jupApiConfig,
      orcaApiConfig,
      sarosApiConfig,
      raydiumApiConfig,
      meteoraApiConfig,
    } = { ...config, ...DexApi.defaultConfig };
    this.jup = new JupApi(jupApiConfig);
    this.orca = new OrcaApi(orcaApiConfig);
    this.saros = new SarosApi(sarosApiConfig);
    this.raydium = new RaydiumApi(raydiumApiConfig);
    this.meteora = new MeteoraApi(meteoraApiConfig);
  }

  async getPair(
    dex: "orca" | "saros-dlmm" | "raydium-clmm" | "meteora" | string,
    pairAddress: string,
  ): Promise<Pair | null> {
    switch (dex) {
      case "orca": {
        const {
          data: [pair],
        } = await this.orca.pool.list({ addresses: [pairAddress] });

        if (pair) {
          const tokens = await this.jup.token.list({
            category: "search",
            query: [pair.tokenA.address, pair.tokenB.address].join(","),
          });

          const mapTokens = collectionToMap(tokens, (token) => token.id);
          const baseToken = mapTokens.get(pair.tokenA.address)!;
          const quoteToken = mapTokens.get(pair.tokenB.address)!;

          return {
            extra: pair,
            baseToken,
            quoteToken,
            ...this.orca.pool.normalize(pair),
          };
        }

        return null;
      }
      case "meteora": {
        const pair = await this.meteora.pair.getPair(pairAddress);
        const tokens = await this.jup.token.list({
          category: "search",
          query: [pair.mint_x, pair.mint_y].join(","),
        });

        const mapTokens = collectionToMap(tokens, (token) => token.id);
        const baseToken = mapTokens.get(pair.mint_x)!;
        const quoteToken = mapTokens.get(pair.mint_y)!;

        return {
          baseToken,
          quoteToken,
          extra: pair,
          ...this.meteora.pair.normalize(
            pair,
            baseToken.decimals,
            quoteToken.decimals,
          ),
        };
      }
      case "raydium-clmm": {
        const {
          data: [pair],
        } = await this.raydium.pool.ids(pairAddress);

        if (pair) {
          const tokens = await this.jup.token.list({
            category: "search",
            query: [pair.mintA.address, pair.mintB.address].join(","),
          });

          const mapTokens = collectionToMap(tokens, (token) => token.id);
          const baseToken = mapTokens.get(pair.mintA.address)!;
          const quoteToken = mapTokens.get(pair.mintB.address)!;

          return {
            baseToken,
            quoteToken,
            extra: pair,
            ...this.raydium.pool.normalize(
              pair,
              baseToken.usdPrice,
              quoteToken.usdPrice,
            ),
          };
        }

        return null;
      }
      case "saros-dlmm": {
        const { data: pair } = await this.saros.pool.retrieve(pairAddress);
        const tokens = await this.jup.token.list({
          category: "search",
          query: [pair.tokenX.mintAddress, pair.tokenY.mintAddress].join(","),
        });

        const mapTokens = collectionToMap(tokens, (token) => token.id);
        const baseToken = mapTokens.get(pair.tokenX.mintAddress)!;
        const quoteToken = mapTokens.get(pair.tokenY.mintAddress)!;

        return {
          baseToken,
          quoteToken,
          extra: pair,
          ...this.saros.pool.normalize(pair),
        };
      }
      default:
        return null;
    }
  }
}
