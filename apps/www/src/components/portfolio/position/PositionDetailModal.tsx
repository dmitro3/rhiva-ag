import clsx from "clsx";
import { useMemo, useState } from "react";
import type { AppRouter } from "@rhiva-ag/trpc";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

import Image from "@/components/Image";
import IcDex from "@/assets/icons/ic_dex";
import { MdClose } from "react-icons/md";
import Decimal from "@/components/Decimal";
import { currencyIntlArgs } from "@/constants/format";

type Position = Awaited<
  ReturnType<AppRouter["position"]["list"]>
>["items"][number];

type PositionDetailModalProps = {
  position: Position;
} & React.ComponentProps<typeof Dialog>;

export default function PositionDetailModal({
  position: { pool, pnls, ...position },
  ...props
}: PositionDetailModalProps) {
  const [pnl] = pnls;
  const [inverse] = useState(false);
  const name = useMemo(() => {
    if (inverse)
      return [pool.baseToken.symbol, pool.quoteToken.symbol].join("/");
    return [pool.quoteToken.symbol, pool.baseToken.symbol].join("/");
  }, [pool, inverse]);
  const currentPrice = useMemo(() => {
    if (pool.config.extra) {
      if (inverse) return 1 / pool.config.extra.currentPrice;

      return pool.config.extra.currentPrice;
    }
    return 0;
  }, [pool.config.extra, inverse]);

  const priceRange = useMemo(() => {
    if (position.config.priceRange) {
      if (inverse) {
        const [lowerPrice, upperPrice] = position.config.priceRange.map(
          (price) => 1 / price,
        );
        return [lowerPrice, upperPrice];
      }
      return position.config.priceRange;
    }
  }, [position.config.priceRange, inverse]);

  return (
    <Dialog
      {...props}
      className="relative z-50"
    >
      <div className="fixed inset-0 flex flex-col items-center justify-center">
        <DialogBackdrop className="absolute inset-0 bg-black/75 -z-10" />
        <DialogPanel className="flex flex-col space-y-4 bg-black border-white/10 p-4 pb-8 rounded-xl lt-sm:w-9/10 sm:min-w-md">
          <header className="flex items-center">
            <div className="flex-1 flex items-center space-x-2">
              <div className="relative flex items-center">
                <Image
                  width={18}
                  height={18}
                  src={pool.baseToken.image}
                  alt={pool.baseToken.symbol}
                  className="rounded-full"
                />
                <Image
                  width={18}
                  height={18}
                  src={pool.quoteToken.image}
                  alt={pool.quoteToken.symbol}
                  className="-ml-2 rounded-full"
                />
              </div>
              <DialogTitle className="text-lg font-medium">
                <span>{pool.baseToken.symbol}</span>-
                <span>{pool.quoteToken.symbol}</span>
              </DialogTitle>
              <IcDex
                dex={pool.dex}
                width={16}
                height={16}
              />
            </div>
            <button
              type="button"
              onClick={() => props.onClose?.(false)}
            >
              <MdClose size={18} />
            </button>
          </header>
          <div className="grid grid-cols-2 gap-2">
            {pool.config?.extra?.currentPrice && (
              <div>
                <p className="text-sm text-gray">Current Price</p>
                <div>
                  <Decimal value={currentPrice} />
                  &nbsp;
                  <span>{name}</span>
                </div>
              </div>
            )}
            {priceRange && (
              <div>
                <p className="text-sm text-gray">Price Range</p>
                <p>
                  <Decimal value={priceRange[0]} />-
                  <Decimal value={priceRange[1]} />
                  &nbsp;{name}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray">Current Balance</p>
              <div>
                <p className="text-base">
                  <span>
                    {pnl.baseAmount} {pool.baseToken.symbol}&nbsp;
                  </span>

                  <span className="text-gray">
                    (
                    <Decimal
                      value={pnl.baseAmountUsd}
                      intlArgs={currencyIntlArgs}
                    />
                    )
                  </span>
                </p>
                <p className="text-base">
                  <span>
                    {pnl.quoteAmount} {pool.quoteToken.symbol}&nbsp;
                  </span>

                  <span className="text-gray">
                    (
                    <Decimal
                      value={pnl.quoteAmountUsd}
                      intlArgs={currencyIntlArgs}
                    />
                    )
                  </span>
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray">Your Unclaimed Fee</p>
              <div>
                <p>
                  <span>
                    {pnl.unclaimedBaseFee} {pool.baseToken.symbol}&nbsp;
                  </span>

                  <span className="text-gray">
                    (
                    <Decimal
                      value={pnl.unclaimedBaseFeeUsd}
                      intlArgs={currencyIntlArgs}
                    />
                    )
                  </span>
                </p>
                <p>
                  <span>
                    {pnl.unclaimedQuoteFee} {pool.quoteToken.symbol}&nbsp;
                  </span>
                  <span className="text-gray">
                    (
                    <Decimal
                      value={pnl.unclaimedQuoteFeeUsd}
                      intlArgs={currencyIntlArgs}
                    />
                    )
                  </span>
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray">Total Liquidity</p>
              <Decimal
                value={pnl.amountUsd}
                intlArgs={currencyIntlArgs}
                className="text-base"
              />
            </div>
            <div>
              <p className="text-sm text-gray">Position Status</p>
              <p
                className={clsx(
                  "text-base",
                  position.active ? "text-primary" : "text-red-500",
                )}
              >
                {position.active ? "Active" : "Not Active"}
              </p>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
