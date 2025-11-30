import { useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";

export const useRefreshPositionQueries = (queryClient: QueryClient) => {
  const refreshPositionQueries = useCallback(
    (_returnvalue: unknown) =>
      queryClient.refetchQueries({
        predicate: (query) => {
          for (const key of query.queryKey) {
            if (Array.isArray(key)) return query.queryKey.includes("position");
            return key === "position";
          }

          return false;
        },
      }),
    [queryClient],
  );

  return refreshPositionQueries;
};
