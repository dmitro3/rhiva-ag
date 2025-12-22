import ms from "ms";
import { toast } from "react-toastify";
import { BiNoEntry } from "react-icons/bi";
import { MdMoreVert } from "react-icons/md";
import { mapFilter } from "@rhiva-ag/shared";
import { RiAiGenerate } from "react-icons/ri";
import { logEvent } from "firebase/analytics";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@rhiva-ag/auth-ui/client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { IoMdRefresh, IoMdGift, IoMdInformation } from "react-icons/io";

import Image from "@/components/Image";
import { useDex } from "@/hooks/useDex";
import PnLCardModal from "./PnLCardModal";
import DexIcon from "@/assets/icons/ic_dex";
import Pagination from "../PositionPagination";
import CopyButton from "@/components/CopyButton";
import { useAnalytics } from "@/hooks/useAnalytics";
import type { Position } from "@/hooks/usePosition";
import { useTRPC, useTRPCClient } from "@/trpc.client";
import PositionDetailModal from "./PositionDetailModal";
import { useClosePosition } from "@/hooks/useClosePosition";
import ConfirmBundleToast from "@/components/ConfirmBundleToast";
import NativeOrUsdAndPercentage from "./NativeOrUsdAndPercentage";
import { useRebalancePosition } from "@/hooks/useRebalancePosition";
import { useClaimPositionReward } from "@/hooks/useClaimPositionReward";
import { useRefreshPositionQueries } from "@/hooks/usePositionManager";

type OpenPositionTableProps = {
  isNative?: boolean;
  nativePrice: number;
};

export default function OpenPositionTable({
  isNative,
  nativePrice,
}: OpenPositionTableProps) {
  const trpc = useTRPC();
  const { user } = useAuth();
  const wallet = useWallet();
  const dexInstance = useDex();
  const analytics = useAnalytics();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const refreshPositionQueries = useRefreshPositionQueries(queryClient);
  const closePosition = useClosePosition(dexInstance, wallet, trpcClient, user);
  const rebalancePosition = useRebalancePosition(
    dexInstance,
    wallet,
    trpcClient,
    user,
  );
  const claimPositionRewards = useClaimPositionReward(
    dexInstance,
    wallet,
    trpcClient,
    user,
  );

  const itemsPerPage = useRef(5);
  const searchParams = useSearchParams();
  const [currentPage, setCurrentPage] = useState(0);
  const [bundleId, setBundleId] = useState<string | undefined>();
  const [showGeneratePnLModal, setShowGeneratePnLModal] = useState(false);
  const [actionType, setActionType] = useState<
    "claim" | "close" | "rebalance" | undefined
  >();
  const [showDetailedPositionModal, setShowDetailedPositionModal] =
    useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(
    null,
  );

  const dex = useMemo(() => searchParams.get("dex"), [searchParams]);

  const { data } = useQuery({
    refetchInterval: 60_000,
    refetchOnMount: true,
    ...trpc.position.list.queryOptions({
      offset: currentPage,
      limit: itemsPerPage.current,
      sortBy: { createdAt: "desc" },
      filter: {
        state: { notInArray: ["closed", "repositioned"] },
      },
    }),
  });

  const totalItems = useMemo(() => (data?.total ? data.total : 0), [data]);
  const [allPositions, positionAggregrate] = useMemo(() => {
    const positions = mapFilter(data?.items ?? [], (position) => {
      const [pnl] = position.pnls;
      if (pnl) {
        const pnlPercentage = pnl.amountUsd
          ? (pnl.pnlUsd / pnl.amountUsd) * 100
          : 0;
        const unCollectedFee =
          pnl.unclaimedFeeUsd +
          pnl.unclaimedRewardsFeeUsd.reduce((acc, reward) => acc + reward, 0);
        const unCollectedFeePercentage = pnl.amountUsd
          ? (unCollectedFee / pnl.amountUsd) * 100
          : 0;
        const collectedFeePercentage = pnl.amountUsd
          ? (pnl.claimedFeeUsd / pnl.amountUsd) * 100
          : 0;

        const data = {
          pnlPercentage,
          unCollectedFee,
          collectedFeePercentage,
          unCollectedFeePercentage,
          extra: position,
          id: position.id,
          pnl: pnl.pnlUsd,
          value: pnl.amountUsd,
          dex: position.pool.dex,
          age: position.createdAt,
          collectedFee: pnl.claimedFeeUsd,
          baseToken: position.pool.baseToken,
          quoteToken: position.pool.quoteToken,
        };
        if (dex) {
          if (dex === data.dex) return data;
          return null;
        } else return data;
      }
    });

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
  }, [data, dex]);

  const onClosePosition = useCallback(
    async (position: Position) => {
      const result = await toast.promise(closePosition(position), {
        error: "Oops! Bundle failed.",
        pending: "Sending transaction bundle...",
        success: "🎉 Bundle sent successfully.",
      });
      if (result) {
        const { bundleId } = result;
        setBundleId(bundleId);
        setActionType("close");

        if (analytics)
          logEvent(analytics, "position_closed", {
            dex,
            bundleId,
            position: position.id,
          });
      }
    },
    [closePosition, dex, analytics],
  );
  const onClaimRewards = useCallback(
    async (position: Position) => {
      const result = await toast.promise(claimPositionRewards(position), {
        error: "Oops! Bundle failed.",
        pending: "Sending transaction bundle...",
        success: "🎉 Bundle sent successfully.",
      });
      if (result) {
        const { bundleId } = result;
        setBundleId(bundleId);
        setActionType("claim");

        if (analytics)
          logEvent(analytics, "rewards_claimed", {
            dex,
            bundleId,
            position: position.id,
          });
      }
    },
    [claimPositionRewards, dex, analytics],
  );
  const onRebalancePositon = useCallback(
    async (position: Position) => {
      const result = await toast.promise(rebalancePosition(position), {
        error: "Oops! Bundle failed.",
        pending: "Sending transaction bundle...",
        success: "🎉 Bundle sent successfully.",
      });
      if (result) {
        const { bundleId } = result;
        setBundleId(bundleId);
        setActionType("rebalance");

        if (analytics)
          logEvent(analytics, "position_rebalanced", {
            bundleId,
            dex: dex,
          });
      }
    },
    [rebalancePosition, dex, analytics],
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
                      <div className="flex flex-nowrap items-center space-x-2 lt-lg:min-w-40">
                        <div className="flex flex-nowrap items-center relative">
                          <Image
                            width={24}
                            height={24}
                            src={position.baseToken.image}
                            alt={position.baseToken.symbol}
                            className="size-6 rounded-full"
                          />
                          <Image
                            width={24}
                            height={24}
                            src={position.quoteToken.image}
                            alt={position.quoteToken.symbol}
                            className="-ml-2 size-6 rounded-full"
                          />
                          <DexIcon
                            dex={position.dex}
                            className="size-4 ml-1"
                          />
                        </div>
                        <p className="text-base font-medium text-nowrap -mr-2">
                          {position.baseToken.symbol}-
                          {position.quoteToken.symbol}
                        </p>
                        <CopyButton
                          content={position.id}
                          className="text-gray mt-2"
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
                          className="flex flex-col absolute bg-dark z-50 border border-white/10 outline-none rounded-md
                          [&_button]:flex [&_button]:items-center [&_button]:space-x-2 [&_button]:text-start [&_button]:text-sm [&_button]:p-2 [&_button]:text-nowrap [&_button:focus]:bg-white/10"
                        >
                          <MenuItem
                            as="button"
                            onClick={() => {
                              setSelectedPosition(position.extra);
                              setShowDetailedPositionModal(true);
                            }}
                          >
                            <IoMdInformation size={18} />
                            <span>Details</span>
                          </MenuItem>
                          <MenuItem
                            as="button"
                            onClick={() => {
                              setSelectedPosition(position.extra);
                              setShowGeneratePnLModal(true);
                            }}
                          >
                            <RiAiGenerate size={18} />
                            <span>Generate PNL Card</span>
                          </MenuItem>
                          <MenuItem
                            as="button"
                            onClick={() => onClaimRewards(position.extra)}
                          >
                            <IoMdGift size={18} />
                            <span>Claim Rewards</span>
                          </MenuItem>
                          <MenuItem
                            as="button"
                            onClick={() => onRebalancePositon(position.extra)}
                          >
                            <IoMdRefresh size={18} />
                            <span>Rebalance Position</span>
                          </MenuItem>
                          <MenuItem
                            as="button"
                            onClick={() => onClosePosition(position.extra)}
                          >
                            <BiNoEntry size={18} />
                            <span>Close Position</span>
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
                    usdValue={positionAggregrate.value}
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
                <td>
                  <NativeOrUsdAndPercentage
                    colorize
                    isNative={isNative}
                    nativePrice={nativePrice}
                    usdValue={positionAggregrate.pnl}
                  />
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
        {bundleId && (
          <ConfirmBundleToast
            bundleId={bundleId}
            setBundleId={setBundleId}
            title="⚡Bundle Sent"
            message={(status) => {
              const base = {
                progress: "Unknown status",
                error: "Oops! Can't confirm this bundle.",
                pending: "Confirming Transaction Bundle...",
              };

              const successMessages: Record<
                "close" | "claim" | "rebalance" | "base",
                string
              > = {
                base: "Unknown status",
                close: "🎉 Position Closed",
                claim: "🎉 Position Reward claimed",
                rebalance: "🎉 Position Rebalanced",
              };

              const key = actionType ?? "base";

              const messages = {
                ...base,
                success: successMessages[key],
              };

              return messages[status];
            }}
            onSuccess={refreshPositionQueries}
          />
        )}
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
