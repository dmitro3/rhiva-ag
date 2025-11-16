"use client";
import type z from "zod";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { poolFilterSchema } from "@rhiva-ag/trpc";

import Header from "@/components/layout/Header";
import PoolTab from "@/components/pools/PoolTab";
import Pagination from "@/components/Pagination";
import SearchInput from "@/components/SearchInput";
import PoolSort from "@/components/pools/PoolSort";
import PoolList from "@/components/pools/PoolList";
import { useTRPC, useTRPCClient } from "@/trpc.client";
import PoolFilter from "@/components/pools/PoolFilter";
import PoolInfoList from "@/components/pools/PoolInfoList";

type PoolClientPageProps = {
  searchParams: {
    sort?: "m5_trending" | "h1_trending" | "h6_trending" | "h24_trending";
    query?: string;
  };
};

export default function PoolClientPage({ searchParams }: PoolClientPageProps) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState<string | undefined>(searchParams.query);

  const { data } = useQuery({
    placeholderData: (previous) => previous,
    queryKey: trpc.pool.list.queryKey({ query, page, ...searchParams }),
    queryFn: () => {
      const data: Partial<z.infer<typeof poolFilterSchema>> = {
        page: page + 1,
        sort: "h24_trending",
        include: "base_token,quote_token",
        ...searchParams,
      };

      if (query) data.query = query;

      return trpcClient.pool.list.query(data);
    },
  });

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
            <div className="flex lt-sm:flex-col sm:items-center sm:justify-between sm:space-x-4">
              <PoolTab className="lt-sm:hidden" />
              <div className="sm:flex sm:items-center sm:space-x-2 lt-sm:flex-1 ">
                <PoolSort />
                <PoolFilter className="lt-lg:hidden" />
              </div>
            </div>
          </div>
          {data && (
            <PoolList
              className="flex-1"
              pools={data}
              sort={searchParams.sort}
            />
          )}
          <div className="flex items-center justify-center">
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
