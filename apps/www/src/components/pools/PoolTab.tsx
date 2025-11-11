import clsx from "clsx";
import Link from "next/link";
import { format } from "util";
import { MdCheck } from "react-icons/md";
import { useSearchParams } from "next/navigation";
import { IoChevronDownOutline } from "react-icons/io5";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";

import { useDexes } from "@/hooks/useDexes";
import IcDex from "@/assets/icons/ic_dex";
import { useMemo } from "react";

export default function PoolTab(props: React.ComponentProps<"div">) {
  const dexes = useDexes();
  const searchParams = useSearchParams();
  const dex = searchParams.get("dexes");

  return (
    <div
      {...props}
      className={clsx("flex flex-nowrap space-x-4", props.className)}
    >
      {dexes.map((tab) => {
        const selected = tab.value === dex;
        const urlSearchParams = new URLSearchParams(searchParams);
        if (tab.value) urlSearchParams.set("dexes", tab.value);
        else urlSearchParams.delete("dexes");

        return (
          <Link
            key={tab.title}
            href={format("?%s", urlSearchParams.toString())}
            className={clsx(
              "shrink-0 flex items-center space-x-2 border-b-4 px-2",
              selected ? "border-primary" : "border-b-transparent",
            )}
          >
            {tab.value && (
              <IcDex
                dex={tab.value}
                width={24}
                height={24}
                className="rounded-full"
              />
            )}
            <span>{tab.title}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function PoolTabSmall(props: React.ComponentProps<typeof Menu>) {
  const dexes = useDexes();

  const searchParams = useSearchParams();
  const dex = searchParams.get("dexes");
  const selectedDex = useMemo(
    () => dexes.find(({ value }) => value === dex),
    [dex, dexes],
  );

  return (
    <Menu
      as="div"
      className={clsx("relative z-50", props.className)}
    >
      <MenuButton className="flex items-center space-x-2 focus:outline-none">
        {selectedDex?.value && (
          <IcDex
            dex={selectedDex.value}
            width={16}
            height={16}
            className="rounded-full"
          />
        )}
        <span>{selectedDex ? selectedDex?.title : "All Pools"}</span>
        <IoChevronDownOutline />
      </MenuButton>
      <MenuItems
        transition
        className="absolute origin-top-right flex flex-col  bg-dark-secondary  text-gray border border-white/10 px-4 py-2 rounded-md transition duration-100 ease-out data-closed:scale-95 data-closed:opacity-0 focus:outline-none"
      >
        {dexes.map((tab) => {
          const selected = tab.value === dex;
          const urlSearchParams = new URLSearchParams(searchParams);
          if (tab.value) urlSearchParams.set("dexes", tab.value);
          else urlSearchParams.delete("dexes");

          return (
            <MenuItem key={tab.title}>
              <Link
                key={tab.title}
                href={format("?%s", urlSearchParams.toString())}
                className="flex space-x-2 items-center py-2"
              >
                {tab.value && (
                  <IcDex
                    dex={tab.value}
                    width={18}
                    height={18}
                    className="rounded-full"
                  />
                )}
                <span>{tab.title}</span>
                {selected && <MdCheck />}
              </Link>
            </MenuItem>
          );
        })}
      </MenuItems>
    </Menu>
  );
}
