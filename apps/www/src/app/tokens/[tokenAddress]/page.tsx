import { format } from "util";
import type { Metadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { dexApi } from "@/instances";
import TokensClientPage from "./page.client";
import type { TimeFrame } from "./page.client";
import { getQueryClient } from "@/trpc.server";
import {
  compactCurrencyIntlArgs,
  percentageIntlArgs,
} from "@/constants/format";

type TokenData = {
  name: string;
  symbol: string;
  icon: string;
  liquidity: number;
  usdPrice: number;
  stats24h: {
    buyOrganicVolume: number;
    sellOrganicVolume: number;
  };
  stats5m: {
    priceChange: number;
  };
  mcap: number;
};

export async function generateMetadata(
  props: PageProps<"/tokens/[tokenAddress]">,
): Promise<Metadata> {
  const params = await props.params;
  const queryClient = getQueryClient();
  const currencyIntl = new Intl.NumberFormat("en-US", compactCurrencyIntlArgs);
  const percentageIntl = new Intl.NumberFormat("en-US", percentageIntlArgs);

  const [token] = await queryClient.fetchQuery({
    queryKey: ["tokens", params.tokenAddress],
    queryFn: () =>
      dexApi.jup.token.list({
        category: "search",
        query: params.tokenAddress,
      }),
  });

  const data: TokenData = {
    name: token.name,
    symbol: token.symbol,
    icon: token.icon,
    liquidity: token.liquidity,
    usdPrice: token.usdPrice,
    stats24h: {
      buyOrganicVolume: token.stats24h.buyOrganicVolume,
      sellOrganicVolume: token.stats24h.sellOrganicVolume,
    },
    stats5m: {
      priceChange: token.stats5m?.priceChange,
    },
    mcap: token.mcap,
  };

  const title = format("%s | Rhiva", token.name);
  const description = format(
    "The live market cap of %s today is %s with a 24-hour change of %s.",
    token.name,
    currencyIntl.format(token.mcap),
    percentageIntl.format(token.stats24h.priceChange),
  );
  const url = format("https://beta.rhiva.fun/tokens/%s/", params.tokenAddress);
  const images = [
    format(
      "%s/api/media/token-card?data=%s",
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

export default async function TokenPage(
  props: PageProps<"/tokens/[tokenAddress]">,
) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["tokens", params.tokenAddress],
    queryFn: () =>
      dexApi.jup.token.list({
        category: "search",
        query: params.tokenAddress,
      }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TokensClientPage
        params={params}
        searchParams={
          searchParams as unknown as { timeframe: keyof typeof TimeFrame }
        }
      />
    </HydrationBoundary>
  );
}
