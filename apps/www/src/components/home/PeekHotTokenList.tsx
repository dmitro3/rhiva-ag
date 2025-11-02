"use client";
import clsx from "clsx";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MdChevronRight } from "react-icons/md";
import { useQuery } from "@tanstack/react-query";

import { dexApi } from "@/instances";
import TokenCard from "../token/TokenCard";

type PeekHotTokenList = {} & React.ComponentProps<"section">;

export default function PeekHotTokenList(props: PeekHotTokenList) {
  const t = useTranslations("HomePage.TokenCard");

  const { data } = useQuery({
    queryKey: ["token", "toptrending"],
    queryFn: () =>
      dexApi.jup.token.list({
        limit: 8,
        timestamp: "1h",
        category: "toptrending",
      }),
  });

  return (
    <section
      {...props}
      className={clsx(
        "flex flex-col space-y-2 bg-dark-secondary p-4 border border-white/6 rounded-xl",
        props.className,
      )}
    >
      <div className="flex items-center">
        <p className="flex-1 text-base text-gray">{t("title")}</p>
        <Link
          href="/tokens"
          className="p-2"
        >
          <MdChevronRight
            size={24}
            className="text-gray"
          />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-y-2 md:grid-cols-2 md:gap-4">
        {data
          ?.filter(
            (token) =>
              token.stats24h.buyOrganicVolume ||
              token.stats24h.sellOrganicVolume,
          )
          .slice(0, 6)
          .map((data) => (
            <TokenCard
              key={data.id}
              token={data}
            />
          ))}
      </div>
    </section>
  );
}
