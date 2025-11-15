import "server-only";

import { cache } from "react";
import { makeTRPCClient } from "@rhiva-ag/auth-ui";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { makeQueryClient } from "./query";

export const getQueryClient = cache(makeQueryClient);
export const getTRPCClient = cache(makeTRPCClient);
export const getTRPC = cache((token?: string) => {
  const client = getTRPCClient(token);
  return createTRPCOptionsProxy({
    client,
    queryClient: getQueryClient,
  });
});
