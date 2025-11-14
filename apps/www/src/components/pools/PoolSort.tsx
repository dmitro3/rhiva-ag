import clsx from "clsx";
import Link from "next/link";
import { format } from "util";
import { useMemo } from "react";
import { GoSortDesc } from "react-icons/go";
import { useSearchParams } from "next/navigation";
import { MdArrowDropDown, MdCheck } from "react-icons/md";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";

export default function PoolSort(props: React.ComponentProps<"div">) {
  const searchParams = useSearchParams();
  const sortBy = searchParams.get("sort");

  const values = useMemo(
    () => [
      { title: "TVL", value: "reserve_in_usd_desc" },
      { title: "24H Volume", value: "h24_volume_desc" },
      { title: "Age", value: "pool_created_at_desc" },
    ],
    [],
  );

  const trendingSorts = useMemo(
    () => [
      { title: "5m", value: "m5_trending" },
      { title: "1h", value: "h1_trending" },
      { title: "6h", value: "h6_trending" },
      { title: "24h", value: null },
    ],
    [],
  );

  const sortTitle = useMemo(
    () => trendingSorts.find((sort) => sort.value === sortBy)?.title,
    [sortBy, trendingSorts],
  );
  return (
    <div
      {...props}
      className={clsx(
        "flex flex-nowrap items-center space-x-4",
        props.className,
      )}
    >
      <div className="flex-1 flex space-x-4 flex-nowrap">
        {values.map((sort) => {
          const selected = sortBy === sort.value;
          const urlSearchParams = new URLSearchParams(searchParams);
          if (selected) urlSearchParams.delete("sort");
          else urlSearchParams.set("sort", sort.value);

          return (
            <Link
              key={sort.value}
              href={format("?%s", urlSearchParams.toString())}
              className="flex items-center space-x-2 lt-sm:flex-1"
            >
              <span className="text-gray text-nowrap">{sort.title}</span>
              <GoSortDesc
                size={18}
                className={clsx("text-primary", !selected && "rotate-180")}
              />
            </Link>
          );
        })}
      </div>
      <Menu
        as="div"
        className="relative"
      >
        <MenuButton
          type="button"
          className="w-20 flex items-center space-x-2 border border-white/10 backdrop-blur px-2 py-1  rounded-md focus:outline-none"
        >
          <span className="text-gray">{sortTitle ?? "None"}</span>
          <MdArrowDropDown
            size={24}
            className="text-gray"
          />
        </MenuButton>
        <MenuItems className="mt-2 absolute flex flex-col bg-dark-secondary border border-white/10 w-full rounded-xl focus:outline-none">
          {trendingSorts.map((sort) => {
            const selected = sortBy === sort.value;
            const urlSearchParams = new URLSearchParams(searchParams);
            if (selected || !sort.value) urlSearchParams.delete("sort");
            else if (sort.value) urlSearchParams.set("sort", sort.value);

            return (
              <MenuItem key={sort.value}>
                <Link
                  href={format("?%s", urlSearchParams.toString())}
                  className={clsx(
                    "flex items-center space-x-2 p-2",
                    selected ? "text-primary" : "text-light",
                  )}
                >
                  <MdCheck
                    className={clsx(
                      "hidden",
                      selected ? "visible text-primary" : "invisible",
                    )}
                  />
                  <span>{sort.title}</span>
                </Link>
              </MenuItem>
            );
          })}
        </MenuItems>
      </Menu>
    </div>
  );
}
