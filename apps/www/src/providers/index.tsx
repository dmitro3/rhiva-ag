"use client";
import { CookiesProvider } from "react-cookie";

import TRPCProvider from "./TRPCProvider";
import ReactQueryProvider from "./ReactQueryProvider";
import LegalModal from "@/components/modals/LegalModal";
import SolanaWalletProvider from "./InternalWalletProvider";

export default function Provider({ children }: React.PropsWithChildren) {
  return (
    <ReactQueryProvider>
      <TRPCProvider>
        <CookiesProvider>
          <SolanaWalletProvider>{children}</SolanaWalletProvider>
          <LegalModal />
        </CookiesProvider>
      </TRPCProvider>
    </ReactQueryProvider>
  );
}
