import { cache } from "react";
import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";

export const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      },
      dehydrate: {
        shouldDehydrateQuery(query) {
          return (
            defaultShouldDehydrateQuery(query) ||
            query.state.status === "pending"
          );
        },
      },
    },
  });
export const getQueryClient = cache(() => new QueryClient());
