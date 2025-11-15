import { getUser } from "@rhiva-ag/auth-ui/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getTRPC } from "@/trpc.server";
import { makeQueryClient } from "@/query";
import { getWalletPNL } from "@/lib/get-tokens";
import PortfolioClientPage from "./page.client";
import { dexApi, solanaConnection } from "@/instances";

export default async function PortfolioPage(props: PageProps<"/portfolio">) {
  const searchParams = await props.searchParams;
  const queryClient = makeQueryClient();

  const user = await getUser();
  const trpc = getTRPC(user.token);

  await queryClient.prefetchQuery({
    queryKey: ["wallet", "tokens", user.wallet.id],
    queryFn: async () => getWalletPNL(solanaConnection, dexApi, user.wallet.id),
  });

  await queryClient.prefetchQuery(
    trpc.position.list.queryOptions({
      offset: 0,
      limit: 5,
      filter: {
        state: { eq: "closed" },
        dex: searchParams.dex ? searchParams.dex : undefined,
      },
    }),
  );
  await queryClient.prefetchQuery(
    trpc.position.list.queryOptions({
      offset: 0,
      limit: 5,
      filter: {
        state: { eq: "open" },
        dex: searchParams.dex ? searchParams.dex : undefined,
      },
    }),
  );

  await queryClient.prefetchQuery(trpc.position.aggregrate.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PortfolioClientPage />
    </HydrationBoundary>
  );
}
