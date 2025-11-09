"use client";
import { useMemo, useState } from "react";
import { mapFilter } from "@rhiva-ag/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Header from "@/components/layout/Header";
import PoolTab from "@/components/pools/PoolTab";
import Pagination from "@/components/Pagination";
import SearchInput from "@/components/SearchInput";
import PoolSort from "@/components/pools/PoolSort";
import { useTRPC, useTRPCClient } from "@/trpc.client";
import PoolFilter from "@/components/pools/PoolFilter";
import PoolInfoList from "@/components/pools/PoolInfoList";
import PoolList, { PoolListSmall } from "@/components/pools/PoolList";

type PoolClientPageProps = {
  searchParams: Record<string, any>;
};

export default function PoolClientPage({ searchParams }: PoolClientPageProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const trpcClient = useTRPCClient();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState<string | undefined>(searchParams.query);

  const { data } = useQuery({
    queryKey: trpc.pool.list.queryKey({ query, page, ...searchParams }),
    queryFn: () =>
      trpcClient.pool.list.query({
        page,
        query,
        sort: "h6_trending",
        include: "base_token,quote_token",
        ...searchParams,
      }),
  });

  const allPages = useMemo(() => {
    const pages = Array.from({ length: page }).map((_, index) => index + 1);
    return mapFilter(
      pages.map((page) => {
        const key = trpc.pool.list.queryKey({ query, page, ...searchParams });
        const data = queryClient.getQueryData(key);
        return data;
      }),
      (data) => data,
    ).flat();
  }, [page, trpc, searchParams, queryClient, query]);

  return (
    <div className="flex-1 flex flex-col overflow-y-scroll">
      <Header
        title="Pools"
        className="sticky top-0 z-10"
      />
      <div className="flex-1 flex flex-col overflow-y-scroll py-4">
        <div className="flex flex-col space-y-4 px-4">
          <div className="flex flex-col space-y-2">
            <div className="flex lt-lg:flex-col lt-lg:space-y-2 lg:items-center lg:justify-between lg:space-x-4">
              <div className="lt-lg:flex lt-lg:space-x-4">
                <SearchInput
                  defaultValue={query}
                  placeholder="Search pools"
                  className="lt-lg:flex-1 lg:self-start lg:min-w-md"
                  onChange={(value) => {
                    setPage(0);
                    if (value) setQuery(value);
                    else setQuery(undefined);
                  }}
                />
                <PoolFilter className="lg:hidden" />
              </div>
              <PoolInfoList className="lg:self-end" />
            </div>
            <div className="flex lt-lg:flex-col lg:items-center lg:justify-between lg:space-x-4">
              <PoolTab className="lt-lg:hidden" />
              <div className="lg:flex lg:items-center lg:space-x-2 lt-lg:flex-1 ">
                <PoolSort />
                <PoolFilter className="lt-lg:hidden" />
              </div>
            </div>
          </div>
          {data && (
            <PoolList
              className="flex-1"
              pools={data}
            />
          )}
          <PoolListSmall pools={allPages} />
          <div className="flex items-center justify-center lt-sm:hidden">
            <Pagination
              maxPage={10}
              totalItems={200}
              itemsPerPage={20}
              currentPage={page}
              setCurrentPage={setPage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
