import { format } from "util";
import Link from "next/link";
import type React from "react";
import { BsDownload } from "react-icons/bs";
import { LuRefreshCw } from "react-icons/lu";
import type { AppRouter } from "@rhiva-ag/trpc";
import { useCallback, useMemo, useState } from "react";
import { MdClose, MdContentCopy } from "react-icons/md";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

import Image from "@/components/Image";
import Toggle from "@/components/Toggle";

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

  const [showProfit, setShowProfit] = useState(true);
  const [showBalance, setShowBalance] = useState(true);

  const pnlUrl = useMemo(() => {
    const info = {
      baseToken: {
        symbol: pool.baseToken.symbol,
      },
      quoteToken: {
        symbol: pool.quoteToken.symbol,
      },
      pnlUsd: pnl.pnlUsd,
      state: position.state,
      hideProfit: !showProfit,
      hideBalance: !showBalance,
      amountUsd: pnl.amountUsd,
      updatedAt: position.updatedAt,
      createdAt: position.createdAt,
    };

    const data = Buffer.from(JSON.stringify(info), "utf-8").toBase64();

    return format(
      "%s/api/media/pnl-card?data=%s&timestamp=%s",
      process.env.NEXT_PUBLIC_MEDIA_URL,
      data,
      Date.now(),
    );
  }, [
    showProfit,
    showBalance,
    pool,
    pnl.pnlUsd,
    pnl.amountUsd,
    position.state,
    position.updatedAt,
    position.createdAt,
  ]);

  const copyCard = useCallback(async () => {
    const blob = await fetch(pnlUrl).then((response) => response.blob());
    if (blob) {
      const item = new ClipboardItem({ [blob.type]: blob });
      return navigator.clipboard.write([item]);
    }
  }, [pnlUrl]);

  return (
    <Dialog
      {...props}
      className="relative z-50"
    >
      <div className="fixed inset-0 flex flex-col items-center justify-center">
        <DialogBackdrop className="absolute inset-0 bg-black/75 -z-10" />
        <DialogPanel className="flex flex-col space-y-4 bg-black border border-white/10 p-4 pb-8 rounded-xl lt-sm:w-9/10 sm:max-w-lg">
          <header className="flex justify-between">
            <DialogTitle className="text-base sm:text-lg">
              Share your position performance
            </DialogTitle>
            <button
              type="button"
              onClick={() => props.onClose?.(false)}
            >
              <MdClose />
            </button>
          </header>
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between">
              <button
                type="button"
                className="flex items-center space-x-2 border border-white/10 px-4 py-2 rounded"
              >
                <LuRefreshCw size={18} />
                <span>Refresh</span>
              </button>
              <div className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <Toggle
                    value={showProfit}
                    onChange={setShowProfit}
                  />
                  <span>Hide Profit</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Toggle
                    value={showBalance}
                    onChange={setShowBalance}
                  />
                  <span>Hide Balance</span>
                </div>
              </div>
            </div>
            <Image
              src={pnlUrl}
              width={512}
              height={288}
              className="h-full w-full rounded-md"
            />
            <div className="flex items-center space-x-4">
              <button
                type="button"
                className="w-36 flex items-center justify-center space-x-2 border border-white/10 px-4 py-2 rounded"
                onClick={copyCard}
              >
                <MdContentCopy size={18} />
                <span>Copy</span>
              </button>
              <Link
                href={pnlUrl}
                download
                type="button"
                target="_blank"
                rel="noopener noreferrer"
                className="w-36 flex items-center justify-center space-x-2 bg-primary text-black px-4 py-2 rounded"
              >
                <BsDownload size={18} />
                <span>Download</span>
              </Link>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
