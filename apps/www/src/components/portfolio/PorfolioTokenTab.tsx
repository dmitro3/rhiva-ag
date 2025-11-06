import clsx from "clsx";
import { useMemo, useState } from "react";
import { TabPanel } from "@headlessui/react";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";

import Decimal from "../Decimal";
import { dexApi } from "@/instances";
import { useAuth } from "@/hooks/useAuth";
import SwapModal from "../modals/SwapModal";
import { getWalletPNL } from "@/lib/get-tokens";
import PortfolioTokenList from "./PortfolioTokenList";
import SendTokenModal from "../modals/SendTokenModal";
import ReceiveTokenModal from "../modals/ReceiveTokenModal";
import { currencyIntlArgs, percentageIntlArgs } from "@/constants/format";

export default function PorfolioTokenTab() {
  const { user } = useAuth();
  const { connection } = useConnection();

  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  const percentageIntl = useMemo(
    () => new Intl.NumberFormat("en-US", percentageIntlArgs),
    [],
  );

  const { data } = useQuery({
    queryKey: ["wallet", "tokens", user.wallet.id],
    queryFn: async () => getWalletPNL(connection, dexApi, user.wallet.id),
  });

  return (
    <>
      <TabPanel className="flex-1 flex flex-col space-y-4">
        {data && (
          <>
            <div className="flex flex-col space-y-2 sm:flex-row sm:justify-between md:border md:px-10 md:py-4 md:border-white/20 md:rounded">
              <div>
                <p className="uppercase text-gray">Total Value</p>
                <div className="flex items-center space-x-2">
                  <Decimal
                    value={data.summary.balance}
                    intlArgs={currencyIntlArgs}
                    className="text-xl font-semibold"
                  />
                  <span
                    className={clsx(
                      data.summary.balanceChange < 0
                        ? "text-red-500"
                        : "text-primary",
                    )}
                  >
                    {percentageIntl.format(data.summary.balanceChange)}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-4 [&_button]:flex-1 [&_button]:min-w-32 [&_button]:bg-white/3 [&_button]:py-2 [&_button]:border [&_button]:border-white/10 [&_button]:rounded">
                {!user.wallet.external && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowSendModal(true)}
                    >
                      Send
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReceiveModal(true)}
                    >
                      Receive
                    </button>
                  </>
                )}

                <button
                  type="button"
                  className="!bg-primary border-none text-black"
                  onClick={() => setShowSwapModal(true)}
                >
                  Swap
                </button>
              </div>
            </div>
            <PortfolioTokenList tokens={data.tokens} />
          </>
        )}
      </TabPanel>
      {showSwapModal && (
        <SwapModal
          modal
          open={showSwapModal}
          onClose={setShowSwapModal}
        />
      )}
      {showReceiveModal && (
        <ReceiveTokenModal
          open={showReceiveModal}
          onClose={setShowReceiveModal}
        />
      )}
      {showSendModal && (
        <SendTokenModal
          open={showSendModal}
          onClose={setShowSendModal}
        />
      )}
    </>
  );
}
