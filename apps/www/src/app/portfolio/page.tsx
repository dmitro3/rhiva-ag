import { getUser } from "@rhiva-ag/auth-ui/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getTRPC } from "@/trpc.server";
import { makeQueryClient } from "@/query";
import { getWalletPNL } from "@/lib/get-tokens";
import PortfolioClientPage from "./page.client";
import { dexApi, solanaConnection } from "@/instances";

export default async function PortfolioPage(_props: PageProps<"/portfolio">) {
  const queryClient = makeQueryClient();

  const user = await getUser();
  const trpc = getTRPC(user.token);

  await queryClient.prefetchQuery({
    queryKey: ["wallet", "tokens", user.wallet.id],
    queryFn: async () => getWalletPNL(solanaConnection, dexApi, user.wallet.id),
  });

  await Promise.all([
    queryClient.prefetchQuery(
      trpc.position.list.queryOptions({
        offset: 0,
        limit: 5,
        sortBy: { createdAt: "desc" },
        filter: {
          state: { notInArray: ["open", "rebalanced"] },
        },
      }),
    ),
    queryClient.prefetchQuery(
      trpc.position.list.queryOptions({
        offset: 0,
        limit: 5,
        sortBy: { createdAt: "desc" },
        filter: {
          state: { notInArray: ["closed", "repositioned"] },
        },
      }),
    ),
  ]);

  await queryClient.prefetchQuery(trpc.position.aggregrate.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PortfolioClientPage />
    </HydrationBoundary>
  );
}
