import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import PoolClientPage from "./page.client";
import { getQueryClient, getTRPC, getTRPCClient } from "@/trpc.server";

export default async function PoolPage(props: PageProps<"/pools">) {
  const searchParams = await props.searchParams;

  const trpc = getTRPC();
  const trpcClient = getTRPCClient();
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: trpc.pool.list.queryKey({ page: 0, ...searchParams }),
    queryFn: () =>
      trpcClient.pool.list.query({
        page: 1,
        sort: "h6_trending",
        include: "base_token,quote_token",
        ...searchParams,
      }),
  });
  await queryClient.prefetchQuery(trpc.pool.analytics.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PoolClientPage searchParams={searchParams} />
    </HydrationBoundary>
  );
}
