import type z from "zod";
import { useAuth } from "@rhiva-ag/auth-ui/client";
import type { NonNullable } from "@rhiva-ag/shared";
import type { walletSelectSchema } from "@rhiva-ag/datasource";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import SwapModal from "@/components/modals/SwapModal";
import SendTokenModal from "@/components/modals/SendTokenModal";
import ReceiveTokenModal from "@/components/modals/ReceiveTokenModal";
import CreateInternalWallet from "@/components/modals/CreateInternalWallet";

export type Wallet = Pick<
  z.infer<typeof walletSelectSchema>,
  "id" | "primary" | "external" | "createdAt"
>;

type TInternalWalletContext = {
  swap(): void;
  send(): void;
  receive(): void;
  create(): void;
  internalWallet?: Wallet;
  externalWallet?: Wallet;
  switchWallet(wallet?: Wallet): void;
};

const InternalWalletContext = createContext<TInternalWalletContext | null>(
  null,
);

export default function SolanaWalletProvider({
  children,
}: React.PropsWithChildren) {
  const { user, updateUser } = useAuth();
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showCreateInternalWalletModal, setShowCreateInternalWalletModal] =
    useState(false);

  const externalWallet = useMemo(
    () => user?.wallets.find((wallet) => wallet.external),
    [user?.wallets],
  );
  const internalWallet = useMemo(
    () => user?.wallets.find((wallet) => !wallet.external),
    [user?.wallets],
  );

  const swap = useCallback(() => setShowSwapModal((prev) => !prev), []);
  const send = useCallback(() => setShowSendModal((prev) => !prev), []);
  const receive = useCallback(() => setShowReceiveModal((prev) => !prev), []);
  const create = useCallback(
    () => setShowCreateInternalWalletModal((prev) => !prev),
    [],
  );

  const switchWallet = useCallback(
    (wallet?: Wallet) => {
      if (wallet) return updateUser({ wallet });
      if (externalWallet && internalWallet)
        return updateUser({
          wallet:
            externalWallet?.id === user.wallet.id
              ? internalWallet
              : externalWallet,
        });
    },
    [externalWallet, internalWallet, user, updateUser],
  );

  return (
    <>
      <SwapModal
        open={showSwapModal}
        onClose={setShowSwapModal}
        modal
      />
      <SendTokenModal
        open={showSendModal}
        onClose={setShowSendModal}
      />
      <ReceiveTokenModal
        open={showReceiveModal}
        onClose={setShowReceiveModal}
      />
      <CreateInternalWallet
        open={showCreateInternalWalletModal}
        onClose={setShowCreateInternalWalletModal}
      />
      <InternalWalletContext.Provider
        value={{
          internalWallet,
          externalWallet,
          send,
          swap,
          receive,
          create,
          switchWallet,
        }}
      >
        {children}
      </InternalWalletContext.Provider>
    </>
  );
}

export const useInternalWallet = () =>
  useContext(InternalWalletContext) as NonNullable<TInternalWalletContext>;
