import { format } from "util";
import type { Metadata, ResolvingMetadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { dexApi } from "@/instances";
import PoolClientPage from "./page.client";
import { getQueryClient } from "@/trpc.server";
import { compactCurrencyIntlArgs } from "@/constants/format";

type PoolData = {
  name: string;
  price?: number;
  apr?: number;
  tvl?: number;
  volume24h: number;
  baseFee: number;
  maxFee: number;
  dex: string;
  baseToken: {
    name: string;
    symbol: string;
    icon: string;
  };
  quoteToken: {
    name: string;
    symbol: string;
    icon: string;
  };
};

export async function generateMetadata(
  props: PageProps<"/pools/[dex]/[poolAddress]">,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const params = await props.params;
  const queryClient = getQueryClient();
  const currencyIntl = new Intl.NumberFormat("en-US", compactCurrencyIntlArgs);

  const pool = await queryClient.fetchQuery({
    queryKey: ["pools", params.dex, params.poolAddress],
    queryFn: async () => {
      const response = await dexApi.getPair(params.dex, params.poolAddress);
      return response!;
    },
  });

  if (pool) {
    const data: PoolData = {
      name: pool.name,
      price: pool.price,
      apr: pool.apr,
      tvl: pool.tvl,
      maxFee: pool.maxFee,
      baseFee: pool.baseFee,
      volume24h: pool.volume24h,
      dex: params.dex,
      baseToken: {
        name: pool.baseToken.name,
        symbol: pool.baseToken.symbol,
        icon: pool.baseToken.icon,
      },
      quoteToken: {
        name: pool.quoteToken.name,
        symbol: pool.quoteToken.symbol,
        icon: pool.quoteToken.icon,
      },
    };

    const title = format(
      "Provide Liquidity for %s on %s | Rhiva",
      pool.name,
      params.dex,
    );
    const description = format(
      "Earn fees by providing liquidity to %s — aggregated across multiple DEXs for higher efficiency. Current TVL: %s, 24h fees: %s.",
      pool.name,
      currencyIntl.format(pool.tvl ?? 0),
      currencyIntl.format(pool.fees24H ?? 0),
    );

    const url = format(
      "https://beta.rhiva.fun/pools/%s/%s",
      params.dex,
      params.poolAddress,
    );
    const images = [
      format(
        "%s/api/media/pool-card?data=%s",
        process.env.NEXT_PUBLIC_MEDIA_URL,
        Buffer.from(JSON.stringify(data), "utf-8").toString("base64"),
      ),
    ];

    return {
      title,
      description,
      openGraph: {
        type: "website",
        url,
        images,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images,
        site: url,
      },
    };
  }

  return (await parent) as Metadata;
}

export default async function PoolPage(
  props: PageProps<"/pools/[dex]/[poolAddress]">,
) {
  const params = await props.params;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["pools", params.dex, params.poolAddress],
    queryFn: async () => dexApi.getPair(params.dex, params.poolAddress),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PoolClientPage params={params} />
    </HydrationBoundary>
  );
}
