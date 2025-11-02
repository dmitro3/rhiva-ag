import ms from "ms";
import { toast } from "react-toastify";
import { MdMoreVert } from "react-icons/md";
import { mapFilter } from "@rhiva-ag/shared";
import { logEvent } from "firebase/analytics";
import type { AppRouter } from "@rhiva-ag/trpc";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";

import Image from "@/components/Image";
import Pagination from "../Pagination";
import PnLCardModal from "./PnLCardModal";
import { useAuth } from "@/hooks/useAuth";
import CopyButton from "@/components/CopyButton";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useTRPC, useTRPCClient } from "@/trpc.client";
import PositionDetailModal from "./PositionDetailModal";
import NativeOrUsdAndPercentage from "./NativeOrUsdAndPercentage";

type OpenPositionTableProps = {
  isNative?: boolean;
  nativePrice: number;
};

type Position = Awaited<
  ReturnType<AppRouter["position"]["list"]>
>["items"][number];

export default function OpenPositionTable({
  isNative,
  nativePrice,
}: OpenPositionTableProps) {
  const trpc = useTRPC();
  const { user } = useAuth();
  const analytics = useAnalytics();
  const trpcClient = useTRPCClient();

  const itemsPerPage = useRef(5);
  const searchParams = useSearchParams();
  const [currentPage, setCurrentPage] = useState(0);
  const [showGeneratePnLModal, setShowGeneratePnLModal] = useState(false);
  const [showDetailedPositionModal, setShowDetailedPositionModal] =
    useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(
    null,
  );

  const dex = useMemo(() => searchParams.get("dex"), [searchParams]);
  const { data } = useQuery(
    trpc.position.list.queryOptions({
      offset: currentPage,
      limit: itemsPerPage.current,
      filter: {
        state: { eq: "open" },
        dex: dex ? { eq: dex } : undefined,
      },
    }),
  );

  const totalItems = useMemo(() => (data?.total ? data.total : 0), [data]);
  const [allPositions, positionAggregrate] = useMemo(() => {
    const positions = data
      ? mapFilter(data.items, (position) => {
          const [pnl] = position.pnls;
          if (pnl) {
            const pnlPercentage = pnl.amountUsd
              ? (pnl.pnlUsd / pnl.amountUsd) * 100
              : 0;
            const unCollectedFeePercentage = pnl.amountUsd
              ? (pnl.feeUsd / pnl.amountUsd) * 100
              : 0;
            const collectedFeePercentage = pnl.amountUsd
              ? (pnl.claimedFeeUsd / pnl.amountUsd) * 100
              : 0;

            return {
              pnlPercentage,
              collectedFeePercentage,
              unCollectedFeePercentage,
              extra: position,
              id: position.id,
              pnl: pnl.pnlUsd,
              value: pnl.amountUsd,
              age: position.createdAt,
              unCollectedFee: pnl.feeUsd,
              collectedFee: pnl.claimedFeeUsd,
              baseToken: position.pool.baseToken,
              quoteToken: position.pool.quoteToken,
            };
          }
        })
      : [];

    const aggregrations = positions.reduce(
      (acc, cur) => ({
        pnl: acc.pnl + cur.pnl,
        value: acc.value + cur.value,
        collectedFee: acc.collectedFee + cur.collectedFee,
        unCollectedFee: acc.unCollectedFee + cur.unCollectedFee,
      }),
      {
        pnl: 0,
        value: 0,
        collectedFee: 0,
        unCollectedFee: 0,
      },
    );

    return [positions, aggregrations];
  }, [data]);

  const closePosition = useCallback(
    async (position: Position) => {
      switch (position.pool.dex) {
        case "meteora": {
          return trpcClient.position.meteora.close.mutate({
            pair: position.pool.id,
            position: position.id,
            slippage: user.settings.slippage * 100,
          });
        }
        case "raydium-clmm": {
          return trpcClient.position.raydium.close.mutate({
            pair: position.pool.id,
            position: position.id,
            slippage: user.settings.slippage * 100,
          });
        }
        case "orca": {
          return trpcClient.position.orca.close.mutate({
            pair: position.pool.id,
            position: position.id,
            slippage: user.settings.slippage * 100,
            tokenA: {
              mint: position.pool.baseToken.id,
              owner: position.pool.baseToken.tokenProgram,
              decimals: position.pool.baseToken.decimals,
            },
            tokenB: {
              mint: position.pool.quoteToken.id,
              owner: position.pool.quoteToken.tokenProgram,
              decimals: position.pool.quoteToken.decimals,
            },
          });
        }
      }
    },
    [trpcClient, user],
  );

  const claimRewards = useCallback(
    async (position: Position) => {
      switch (position.pool.dex) {
        case "meteora": {
          return trpcClient.position.meteora.claim.mutate({
            pair: position.pool.id,
            position: position.id,
            slippage: user.settings.slippage * 100,
          });
        }
        case "raydium-clmm": {
          return trpcClient.position.raydium.claim.mutate({
            pair: position.pool.id,
            position: position.id,
            slippage: user.settings.slippage * 100,
          });
        }
        case "orca": {
          return trpcClient.position.orca.claim.mutate({
            pair: position.pool.id,
            position: position.id,
            slippage: user.settings.slippage * 100,
            tokenA: {
              mint: position.pool.baseToken.id,
              owner: position.pool.baseToken.tokenProgram,
              decimals: position.pool.baseToken.decimals,
            },
            tokenB: {
              mint: position.pool.quoteToken.id,
              owner: position.pool.quoteToken.tokenProgram,
              decimals: position.pool.quoteToken.decimals,
            },
          });
        }
      }
    },
    [trpcClient, user],
  );

  const onClosePosition = useCallback(
    async (position: Position) => {
      const result = await toast.promise(closePosition(position), {
        pending: "Sending close position transaction...",
        success: "🎉 Transaction bundle sent successfully.",
        error: "Oops! Transaction failed.",
      });
      if (result) {
        const { bundleId } = result;
        if (analytics)
          logEvent(analytics, "position_closed", {
            bundleId,
            dex,
          });
      }
    },
    [closePosition, dex, analytics],
  );
  const onClaimRewards = useCallback(
    async (position: Position) => {
      const result = await toast.promise(claimRewards(position), {
        pending: "Sending claim reward transaction...",
        success: "Transaction bundle sent successfully.",
        error: "Oops! Transaction failed.",
      });
      if (result) {
        const { bundleId } = result;
        if (analytics)
          logEvent(analytics, "rewards_claimed", {
            bundleId,
            dex: dex,
          });
      }
    },
    [claimRewards, dex, analytics],
  );

  return (
    <>
      <div className="flex-1 flex flex-col border rounded-md border-gray [&_div]:border-gray [&_tr]:border-gray [&_thead]:border-gray">
        <div className="flex-1 overflow-x-scroll">
          <p className="caption-top text-start p-4">
            Open Positions ({allPositions.length})
          </p>
          <table className="border-b table-auto overflow-x-scroll border-collapse lt-lg:[border-spacing:1rem] sm:w-full sm:table-auto sm:empty-cells-hidden">
            <thead className="border-y overflow-x-scroll">
              <tr className="text-sm [&_th]:text-start [&_th]:font-normal [&_th]:px-4 [&_th]:py-2">
                <th className="text-nowrap">Position/Pool</th>
                <th>Age</th>
                <th>Value</th>
                <th className="text-nowrap">Collected Fee</th>
                <th className="text-nowrap">Uncollected Fee</th>
                <th>UPnL</th>
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
                        usdValue={position.collectedFee}
                        percentageValue={position.collectedFeePercentage}
                      />
                    </td>
                    <td>
                      <NativeOrUsdAndPercentage
                        isNative={isNative}
                        nativePrice={nativePrice}
                        usdValue={position.unCollectedFee}
                        percentageValue={position.unCollectedFeePercentage}
                      />
                    </td>
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
                        <MenuButton className="p-2">
                          <MdMoreVert />
                        </MenuButton>
                        <MenuItems
                          anchor={{
                            gap: -16,
                            padding: 96,
                            to: "bottom start",
                          }}
                          className="flex flex-col absolute bg-dark z-50 border border-white/10 rounded-md [&_button]:text-start [&_button]:text-xs [&_button]:p-2 [&_button]:text-nowrap [&_button:focus]:bg-white/10"
                        >
                          <MenuItem
                            as="button"
                            onClick={() => {
                              setSelectedPosition(position.extra);
                              setShowDetailedPositionModal(true);
                            }}
                          >
                            Details
                          </MenuItem>
                          <MenuItem
                            as="button"
                            onClick={() => {
                              setSelectedPosition(position.extra);
                              setShowGeneratePnLModal(true);
                            }}
                          >
                            Generate PNL Card
                          </MenuItem>
                          <MenuItem
                            as="button"
                            onClick={() => onClaimRewards(position.extra)}
                          >
                            Claim Rewards
                          </MenuItem>
                          <MenuItem
                            as="button"
                            onClick={() => onClosePosition(position.extra)}
                          >
                            Close Rewards
                          </MenuItem>
                        </MenuItems>
                      </Menu>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td>Total</td>
                <td></td>
                <td>
                  <NativeOrUsdAndPercentage
                    isNative={isNative}
                    nativePrice={nativePrice}
                    usdValue={positionAggregrate.pnl}
                  />
                </td>
                <td>
                  <NativeOrUsdAndPercentage
                    isNative={isNative}
                    nativePrice={nativePrice}
                    usdValue={positionAggregrate.collectedFee}
                  />
                </td>
                <td>
                  <NativeOrUsdAndPercentage
                    isNative={isNative}
                    nativePrice={nativePrice}
                    usdValue={positionAggregrate.unCollectedFee}
                  />
                </td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage.current}
          setCurrentPage={setCurrentPage}
        />
      </div>
      {selectedPosition && (
        <PositionDetailModal
          open={showDetailedPositionModal}
          position={selectedPosition}
          onClose={() => setShowDetailedPositionModal(false)}
        />
      )}
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
