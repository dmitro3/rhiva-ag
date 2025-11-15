"use client";
import clsx from "clsx";
import Link from "next/link";
import { format } from "util";
import { useMemo, use } from "react";
import { useQuery } from "@tanstack/react-query";

import Header from "@/components/layout/Header";
import { useTRPC, useTRPCClient } from "@/trpc.client";
import MessageTab from "@/components/messages/MessageTab";

export default function MessagePage({ searchParams }: PageProps<"/messages">) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const { tab } = use(
    searchParams as Promise<{ tab: "announcement" | "transaction" | "alert" }>,
  );

  const { data } = useQuery({
    queryKey: trpc.notification.list.queryKey(),
    queryFn: () =>
      trpcClient.notification.list.query({
        limit: 24,
        offset: 0,
      }),
  });

  const tabs = useMemo(
    () => [
      { title: "Announcement", value: undefined },
      { title: "Transactions", value: "transaction" },
      { title: "Alerts", value: "alert" },
    ],
    [],
  );

  return (
    <div className="flex-1 flex flex-col overflow-y-scroll lt-sm:fixed lt-sm:inset-0 lt-md:z-50 lt-sm:bg-dark">
      <Header
        canBack
        className="sticky top-0 z-10"
      />
      <div className="flex flex-col space-y-4 px-4 pt-8 md:self-center">
        <div className="flex space-x-2  md:space-x-8">
          {tabs.map(({ value, title }) => {
            const selected = tab === value;
            const urlSearchParams = new URLSearchParams({ tab });
            if (selected || !value) urlSearchParams.delete("tab");
            else if (value) urlSearchParams.set("tab", value);

            return (
              <Link
                key={value}
                href={format("?%s", urlSearchParams.toString())}
                className={clsx(
                  "flex-1 text-center border-b-2 py-2",
                  selected ? "border-primary" : "border-transparent",
                )}
              >
                {title}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-col space-y-4">
          {data?.map((message) => (
            <MessageTab key={message.id} />
          ))}
        </div>
      </div>
    </div>
  );
}
