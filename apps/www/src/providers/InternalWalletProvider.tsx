import type z from "zod";
import { useAuth } from "@rhiva-ag/auth-ui/client";
import type { NonNullable } from "@rhiva-ag/shared";
import { useMutation } from "@tanstack/react-query";
import type { safeWalletSchema } from "@rhiva-ag/trpc";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { useTRPC } from "@/trpc.client";
import SwapModal from "@/components/modals/SwapModal";
import SendTokenModal from "@/components/modals/SendTokenModal";
import ReceiveTokenModal from "@/components/modals/ReceiveTokenModal";
import CreateInternalWallet from "@/components/modals/CreateInternalWallet";

export type Wallet = z.infer<typeof safeWalletSchema>;

type TInternalWalletContext = {
  swap(): void;
  send(): void;
  receive(): void;
  create(): void;
  internalWallet?: Wallet;
  externalWallet?: Wallet;
  switchWallet(wallet: Wallet): Promise<unknown>;
};

const InternalWalletContext = createContext<TInternalWalletContext | null>(
  null,
);

// todo: support multiple wallets switching
// this model assume there is only two wallets types external and internal wallet
export default function SolanaWalletProvider({
  children,
}: React.PropsWithChildren) {
  const trpc = useTRPC();
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

  const { mutateAsync } = useMutation(
    trpc.wallet.update.mutationOptions({
      onSuccess(wallet) {
        return updateUser({ wallet });
      },
    }),
  );

  const swap = useCallback(() => setShowSwapModal((prev) => !prev), []);
  const send = useCallback(() => setShowSendModal((prev) => !prev), []);
  const receive = useCallback(() => setShowReceiveModal((prev) => !prev), []);
  const create = useCallback(
    () => setShowCreateInternalWalletModal((prev) => !prev),
    [],
  );

  const switchWallet = useCallback(
    async (wallet: Wallet) => {
      // todo: show loading in ui instead
      updateUser({
        wallet: { ...wallet, primary: true },
        wallets: user.wallets.map((item) => {
          if (item.id === wallet.id) return { ...item, primary: true };
          return { ...item, primary: false };
        }),
      });
      mutateAsync({ id: wallet.id, primary: true });
    },
    [mutateAsync, user.wallets, updateUser],
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
