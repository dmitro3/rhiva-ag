import type { AppRouter } from "@rhiva-ag/trpc";
import { type RefObject, useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

import type { TDex } from "./useDexes";

export type Position = Awaited<
  ReturnType<AppRouter["position"]["list"]>
>["items"][number];

export const usePosition = (
  currentPage: number,
  itemsPerPage: RefObject<number>,
  queryClient: QueryClient,
  trpc: TRPCOptionsProxy<AppRouter>,
) => {
  const setPosition = useCallback(
    (position: Position, state?: "open" | "closed", dex?: TDex) => {
      queryClient.setQueryData(
        trpc.position.list.queryKey({
          offset: currentPage,
          limit: itemsPerPage.current,
          filter: {
            state: { eq: state },
            dex: dex ? { eq: dex } : undefined,
          },
        }),
        (previousData) => {
          if (previousData)
            previousData.items = [position, ...previousData.items];
          return previousData;
        },
      );
    },
    [queryClient, currentPage, trpc, itemsPerPage.current],
  );
  const updatePosition = useCallback(
    (
      position: Partial<Position> & Pick<Position, "id">,
      state?: "open" | "closed",
      dex?: TDex,
    ) => {
      queryClient.setQueryData(
        trpc.position.list.queryKey({
          offset: currentPage,
          limit: itemsPerPage.current,
          filter: {
            state: { eq: state },
            dex: dex ? { eq: dex } : undefined,
          },
        }),
        (previousData) => {
          if (previousData) {
            const index = previousData.items.findIndex(
              (item) => item.id === position.id,
            );
            if (index > -1) {
              const previous = previousData.items[index];
              previousData.items[index] = {
                ...previous,
                ...position,
              } as Position;
            }
          }

          return previousData;
        },
      );
    },
    [queryClient, currentPage, trpc, itemsPerPage.current],
  );
  const removePosition = useCallback(
    (position: Position["id"], state?: "open" | "closed", dex?: TDex) => {
      queryClient.setQueryData(
        trpc.position.list.queryKey({
          offset: currentPage,
          limit: itemsPerPage.current,
          filter: {
            state: { eq: state },
            dex: dex ? { eq: dex } : undefined,
          },
        }),
        (previousData) => {
          if (previousData)
            previousData.items = previousData.items.filter(
              (item) => item.id !== position,
            );

          return previousData;
        },
      );
    },
    [queryClient, currentPage, trpc, itemsPerPage.current],
  );

  return { setPosition, updatePosition, removePosition };
};
