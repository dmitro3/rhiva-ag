import clsx from "clsx";
import { format } from "util";
import { useMemo, useState } from "react";
import type { AppRouter } from "@rhiva-ag/trpc";
import { useQuery } from "@tanstack/react-query";
import { collectionToMap } from "@rhiva-ag/shared";
import {
  IoChevronBackOutline,
  IoChevronDownOutline,
  IoChevronForwardOutline,
} from "react-icons/io5";
import Decimal from "../Decimal";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";

import { useTRPC } from "@/trpc.client";
import { getCalender } from "@/lib/calender";
import { currencyIntlArgs } from "@/constants/format";

type PNL = Awaited<ReturnType<AppRouter["pnl"]["history"]>>[number];

export function PortfolioHistory(props: React.ComponentProps<"div">) {
  const calender = useMemo(() => <PortfolioCalender />, []);
  return (
    <>
      <div className={clsx("lt-sm:hidden", props.className)}>
        <h1 className="text-gray">Profit History</h1>
        {calender}
      </div>
      <PortfolioHistorySmall className={clsx("sm:hidden", props.className)}>
        {calender}
      </PortfolioHistorySmall>
    </>
  );
}

function PortfolioCalender(props: React.ComponentProps<"div">) {
  const trpc = useTRPC();
  const intl = useMemo(
    () =>
      Intl.NumberFormat("en-US", {
        ...currencyIntlArgs,
        maximumFractionDigits: 3,
      }),
    [],
  );
  const [calender, setCalender] = useState<ReturnType<typeof getCalender>>(
    getCalender(undefined),
  );

  const { data } = useQuery({
    ...trpc.pnl.history.queryOptions({
      start: calender.dates[0].toDate(),
      end: calender.dates[calender!.dates.length - 1].toDate(),
    }),
    enabled: Boolean(calender?.dates),
  });

  const mapDailyPnlData = useMemo(
    () =>
      data ? collectionToMap(data, (pnl) => pnl.day) : new Map<string, PNL>(),
    [data],
  );

  const totalMonthlyProfit = useMemo(
    () => (data ? data.reduce((acc, cur) => acc + cur.pnlUsd, 0) : 0),
    [data],
  );

  const goToPreviousMonth = () => {
    setCalender(getCalender(calender?.previous));
  };

  const goToNextMonth = () => {
    setCalender(getCalender(calender?.next));
  };

  if (calender) {
    const [peek] = calender.dates;

    return (
      <div
        {...props}
        className={clsx("flex flex-col space-y-4", props.className)}
      >
        <div className="self-end flex items-center space-x-2">
          <button
            type="button"
            className="p-2"
            onClick={goToPreviousMonth}
          >
            <IoChevronBackOutline />
          </button>
          <span className="uppercase font-medium">
            {peek.format("MMM YYYY")}
          </span>
          <button
            type="button"
            className="p-2"
            onClick={goToNextMonth}
          >
            <IoChevronForwardOutline />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-x-2 gap-y-2">
          {calender.weekdays.map((weekday) => (
            <div
              key={weekday}
              className="capitalize text-gray text-center p-2"
            >
              {weekday}
            </div>
          ))}
          {calender.calendarGrid.map((week, weekIndex) =>
            week.map((cell, index) => {
              const pnl = cell
                ? mapDailyPnlData.get(cell.format("YYYY-MM-D"))?.pnlUsd
                : undefined;
              return (
                <div
                  key={format("%s-%s", weekIndex, index)}
                  className={clsx(
                    "flex flex-col items-center justify-center md:aspect-square/4 text-center p-2",
                    cell && "border border-primary/20 rounded bg-primary/5",
                  )}
                >
                  {cell && (
                    <div className="flex flex-col space-y-1 text-gray font-medium text-sm">
                      <p>{cell.date()}</p>
                      {pnl && (
                        <>
                          <Decimal
                            as="p"
                            value={pnl}
                            intlArgs={currencyIntlArgs}
                            className={clsx(
                              "text-nowrap lt-sm:hidden",
                              pnl >= 0 ? "text-primary" : "text-red-500",
                            )}
                          />
                          <p
                            className={clsx(
                              "text-nowrap sm:hidden",
                              pnl >= 0 ? "text-primary" : "text-red-500",
                            )}
                          >
                            {intl.format(pnl)}
                          </p>
                        </>
                      )}
                      {!pnl && <p className="invisible">k</p>}
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>

        <div className="flex">
          <p className="text-gray font-medium">
            <span className="text-sm">TOTAL MONTHLY PROFIT &nbsp;</span>
            <Decimal
              value={totalMonthlyProfit}
              intlArgs={currencyIntlArgs}
              className={clsx(
                "font-bold",
                totalMonthlyProfit >= 0 ? "text-primary" : "text-red-500",
              )}
            />
          </p>
        </div>
      </div>
    );
  }
}

function PortfolioHistorySmall({
  children,
  ...props
}: React.PropsWithChildren & React.ComponentProps<typeof Disclosure>) {
  return (
    <Disclosure
      as="div"
      {...props}
      className={clsx(
        "flex flex-col space-y-8 border border-white/10 px-4 py-2 rounded-md",
        props.className,
      )}
    >
      <DisclosureButton className="group flex justify-between items-center">
        <span className="text-base text-gray">Profit History</span>
        <IoChevronDownOutline
          size={18}
          className="text-gray group-data-open:rotate-180"
        />
      </DisclosureButton>
      <DisclosurePanel>{children}</DisclosurePanel>
    </Disclosure>
  );
}
