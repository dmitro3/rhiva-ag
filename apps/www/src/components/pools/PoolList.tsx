import clsx from "clsx";
import { format } from "util";
import Link from "next/link";
import type { AppRouter } from "@rhiva-ag/trpc";
import type { NonNullable } from "@rhiva-ag/shared";

import Image from "../Image";
import Decimal from "../Decimal";
import CopyButton from "../CopyButton";
import { PoolTabSmall } from "./PoolTab";
import IcDex from "@/assets/icons/ic_dex";
import { compactCurrencyIntlArgs, currencyIntlArgs } from "@/constants/format";

type PoolListProps = {
  pools: NonNullable<Awaited<ReturnType<AppRouter["pool"]["list"]>>>;
} & React.ComponentProps<"div" | "table">;

export default function PoolList({ pools, ...props }: PoolListProps) {
  return (
    <div
      {...props}
      className={clsx(
        "flex flex-wrap gap-4 lt-sm:hidden sm:grid sm:grid-cols-[repeat(auto-fit,minmax(320px,2fr))]",
        props.className,
      )}
    >
      {pools.map((pool) => (
        <Link
          key={pool.address}
          href={format("/pools/%s/%s/", pool.dex.id, pool.address)}
          className="flex flex-col space-y-4 bg-dark-secondary p-4  border border-white/10 rounded-xl xl:min-w-72"
        >
          <div className="flex space-x-2 items-center">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Image
                  width={24}
                  height={24}
                  alt={pool.base_token.name}
                  src={pool.base_token.image_url}
                  className="size-8 rounded-full"
                />
                <Image
                  width={24}
                  height={24}
                  alt={pool.base_token.name}
                  src={pool.quote_token.image_url}
                  className="absolute -left-1 top-3 size-5 rounded-full"
                />
              </div>
              <p className="font-semibold mr-2">
                {pool.name.replace(/\s/g, "").replace(/\//g, "-")}
              </p>
            </div>
            <CopyButton content={pool.address} />
            <IcDex
              dex={pool.dex.id}
              className="size-4 rounded-full"
            />
          </div>
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between">
              <p className="text-gray">TVL</p>
              <Decimal
                value={pool.reserve_in_usd}
                intlArgs={currencyIntlArgs}
              />
            </div>
            <div className="flex justify-between">
              <p className="text-gray">FDV</p>
              <Decimal
                value={pool.fdv_usd ?? 0}
                intlArgs={currencyIntlArgs}
              />
            </div>
            <div className="flex justify-between">
              <p className="text-gray">MCap</p>
              <Decimal
                value={pool.market_cap_usd ?? 0}
                intlArgs={currencyIntlArgs}
              />
            </div>
            <div className="flex justify-between">
              <p className="text-gray">24H VOL</p>
              <Decimal
                value={pool.volume_usd.h24 ?? 0}
                intlArgs={currencyIntlArgs}
              />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

type PoolListSmallProps = {
  pools: NonNullable<Awaited<ReturnType<AppRouter["pool"]["list"]>>>;
} & Pick<React.ComponentProps<"table">, "className">;

export function PoolListSmall({ pools, ...props }: PoolListSmallProps) {
  return (
    <table
      {...props}
      className={clsx("sm:hidden", props.className)}
    >
      <thead>
        <tr className="text-xs text-gray">
          <td>#</td>
          <td>
            <PoolTabSmall />
          </td>
          <td>FDV/Mcap</td>
          <td className="text-end text-nowrap">TVL/24H VOL</td>
        </tr>
      </thead>
      <tbody className="h-full divide-y divide-white/10 overflow-y-scroll">
        {pools.map((pool, index) => (
          <tr key={pool.address}>
            <td>{index + 1}</td>
            <td>
              <Link
                key={pool.address}
                href={format("/pools/%s/%s/", pool.dex.id, pool.address)}
                className="flex items-center"
              >
                <div className="shrink-0 relative mr-2">
                  <Image
                    width={24}
                    height={24}
                    alt={pool.base_token.name}
                    src={pool.base_token.image_url}
                    className="size-8 rounded-full"
                  />
                  <Image
                    width={24}
                    height={24}
                    alt={pool.base_token.name}
                    src={pool.quote_token.image_url}
                    className="absolute -left-1 top-3 size-5 rounded-full"
                  />
                </div>
                <p className="font-semibold mr-2">
                  {pool.name.replace(/\s/g, "").replace(/\//g, "-")}
                </p>
                <CopyButton
                  content={pool.address}
                  className="text-gray mr-1 lt-sm:text-xs"
                />
                <IcDex
                  dex={
                    pool.dex.id as
                      | "orca"
                      | "saros-dlmm"
                      | "raydium-clmm"
                      | "meteora"
                  }
                  width={16}
                  height={16}
                />
              </Link>
            </td>
            <td>
              <Decimal
                as="p"
                value={pool.fdv_usd ?? 0}
                intlArgs={compactCurrencyIntlArgs}
              />
              <Decimal
                as="p"
                className="text-primary"
                value={pool.market_cap_usd ?? 0}
                intlArgs={compactCurrencyIntlArgs}
              />
            </td>
            <td className="text-end">
              <Decimal
                as="p"
                className="text-primary"
                value={pool.reserve_in_usd ?? 0}
                intlArgs={compactCurrencyIntlArgs}
              />
              <Decimal
                as="p"
                value={pool.volume_usd.h24 ?? 0}
                intlArgs={compactCurrencyIntlArgs}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
