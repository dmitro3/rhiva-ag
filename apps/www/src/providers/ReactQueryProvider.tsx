"use client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { makeQueryClient } from "@/query";
import {
  isServer,
  type QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

let browserQueryClient: QueryClient;
function getQueryClient() {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();

  return browserQueryClient;
}

export default function ReactQueryProvider({
  children,
}: React.PropsWithChildren) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools
        client={queryClient}
        initialIsOpen={false}
      />
    </QueryClientProvider>
  );
}
