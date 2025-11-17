import ms from "ms";
import { MdMoreVert } from "react-icons/md";
import { mapFilter } from "@rhiva-ag/shared";
import type { AppRouter } from "@rhiva-ag/trpc";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";

import Image from "@/components/Image";
import { useTRPC } from "@/trpc.client";
import PnLCardModal from "./PnLCardModal";
import Pagination from "../PositionPagination";
import CopyButton from "@/components/CopyButton";
import NativeOrUsdAndPercentage from "./NativeOrUsdAndPercentage";

type ClosePositionTableProps = {
  isNative?: boolean;
  nativePrice: number;
};

export default function ClosePositionTable({
  isNative,
  nativePrice,
}: ClosePositionTableProps) {
  const trpc = useTRPC();
  const itemsPerPage = useRef(5);
  const searchParams = useSearchParams();
  const dex = searchParams.get("dex");
  const [currentPage, setCurrentPage] = useState(0);
  const [showGeneratePnLModal, setShowGeneratePnLModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<
    Awaited<ReturnType<AppRouter["position"]["list"]>>["items"][number] | null
  >(null);

  const { data } = useQuery(
    trpc.position.list.queryOptions({
      offset: currentPage,
      limit: itemsPerPage.current,
      filter: {
        state: { eq: "closed" },
        dex: dex ? { eq: dex } : undefined,
      },
    }),
  );

  const totalItems = useMemo(() => (data?.total ? data.total : 0), [data]);

  const allPositions = useMemo(() => {
    return mapFilter(data?.items ?? [], (position) => {
      const [pnl] = position.pnls;
      if (pnl) {
        const pnlPercentage = pnl.amountUsd
          ? (pnl.pnlUsd / pnl.amountUsd) * 100
          : 0;
        const earnedPercentage = pnl.amountUsd
          ? (pnl.claimedFeeUsd / pnl.amountUsd) * 100
          : 0;

        return {
          pnlPercentage,
          earnedPercentage,
          extra: position,
          id: position.id,
          pnl: pnl.pnlUsd,
          value: pnl.amountUsd,
          age: position.createdAt,
          closed: position.updatedAt,
          earned: pnl.claimedFeeUsd,
          baseToken: position.pool.baseToken,
          quoteToken: position.pool.quoteToken,
        };
      }
    });
  }, [data]);

  return (
    <>
      <div className="flex-1 flex flex-col border rounded-md border-gray [&_div]:border-gray [&_tr]:border-gray [&_thead]:border-gray">
        <div className="flex-1 overflow-x-scroll">
          <p className="caption-top text-start p-4">
            Closed Positions ({allPositions.length})
          </p>
          <table className="border-b table-auto overflow-x-scroll border-collapse lt-lg:[border-spacing:1rem] sm:w-full sm:table-auto sm:empty-cells-hidden">
            <thead className="border-y overflow-x-scroll">
              <tr className="text-sm [&_th]:text-start [&_th]:font-normal [&_th]:px-4 [&_th]:py-2">
                <th className="text-nowrap">Position/Pool</th>
                <th>Age</th>
                <th>Invested</th>
                <th className="text-nowrap">Earned</th>
                <th>UPnL</th>
                <th className="text-nowrap">Closed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {allPositions.map((position) => {
                return (
                  <tr
                    key={position.id}
                    className="border-b [&_td]:px-4 [&_td]:py-2"
                  >
                    <td>
                      <div className="flex items-center space-x-2 lt-lg:min-w-32">
                        <div className="flex flex-nowrap relative">
                          <Image
                            width={24}
                            height={24}
                            src={position.baseToken.image}
                            alt={position.baseToken.symbol}
                            className="size-4"
                          />
                          <Image
                            width={24}
                            height={24}
                            src={position.quoteToken.image}
                            alt={position.quoteToken.symbol}
                            className="-ml-2 size-4 rounded-full"
                          />
                        </div>
                        <p className="text-base font-medium text-nowrap">
                          {position.baseToken.symbol}-
                          {position.quoteToken.symbol}
                        </p>
                        <CopyButton
                          content={position.id}
                          className="text-gray"
                        />
                      </div>
                    </td>
                    <td className="lt-lg:text-nowrap">
                      {ms(Date.now() - position.age.getTime())}
                    </td>
                    <td>
                      <NativeOrUsdAndPercentage
                        isNative={isNative}
                        nativePrice={nativePrice}
                        usdValue={position.value}
                        showNativeIcon
                      />
                    </td>
                    <td>
                      <NativeOrUsdAndPercentage
                        colorize
                        isNative={isNative}
                        nativePrice={nativePrice}
                        usdValue={position.earned}
                        percentageValue={position.earnedPercentage}
                      />
                    </td>
                    <td>{ms(Date.now() - position.closed.getTime())}</td>
                    <td>
                      <NativeOrUsdAndPercentage
                        colorize
                        isNative={isNative}
                        nativePrice={nativePrice}
                        usdValue={position.pnl}
                        percentageValue={position.pnlPercentage}
                      />
                    </td>
                    <td>
                      <Menu>
                        <MenuButton>
                          <MdMoreVert />
                        </MenuButton>
                        <MenuItems
                          anchor={{
                            gap: -16,
                            padding: 96,
                            to: "bottom start",
                          }}
                          className="flex flex-col absolute bg-dark z-50 border border-white/10 text-sm rounded-md [&_button]:text-start [&_button]:text-xs [&_button]:p-2 [&_button]:text-nowrap"
                        >
                          <MenuItem
                            as="button"
                            className="p-2"
                            onClick={() => {
                              setShowGeneratePnLModal(true);
                              setSelectedPosition(position.extra);
                            }}
                          >
                            Generate PNL Card
                          </MenuItem>
                        </MenuItems>
                      </Menu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          setCurrentPage={setCurrentPage}
          itemsPerPage={itemsPerPage.current}
        />
      </div>
      {selectedPosition && (
        <PnLCardModal
          open={showGeneratePnLModal}
          position={selectedPosition}
          onClose={() => setShowGeneratePnLModal(false)}
        />
      )}
    </>
  );
}
