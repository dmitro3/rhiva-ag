import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { dexApi } from "@/instances";
import { getQueryClient } from "@/trpc.server";
import Header from "@/components/layout/Header";
import HeroSection from "@/components/home/HeroSection";
import ProductList from "@/components/home/ProductList";
import OnchainAnalytic from "@/components/home/OnchainAnalytic";
import PeekHotTokenList from "@/components/home/PeekHotTokenList";

export default async function Home() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["token", "toptrending"],
    queryFn: () =>
      dexApi.jup.token.list({
        limit: 8,
        timestamp: "1h",
        category: "toptrending",
      }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex-1 flex flex-col overflow-y-scroll">
        <Header className="sticky top-0 z-10" />
        <div className="flex-1 flex flex-col pt-4 overflow-y-scroll min-h-0">
          <div className="flex-1 flex flex-col space-y-4 py-4">
            <HeroSection className="mx-4 min-h-56 md:max-h-96 md:mx-8" />
            <ProductList className="px-4 md:px-8 max-w-7xl w-full" />
            <div className="flex-1 lt-xl:flex lt-xl:flex-col lt-xl:space-y-4 xl:grid xl:grid-cols-2 xl:gap-4">
              <OnchainAnalytic className="lt-xl:px-4 xl:flex-1 xl:ml-4 xl:md:ml-8" />
              <PeekHotTokenList className="flex-1 lt-xl:mx- xl:mr-4 xl:md:mr-8" />
            </div>
          </div>
        </div>
      </div>
    </HydrationBoundary>
  );
}
