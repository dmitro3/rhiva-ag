import { useAuth } from "@rhiva-ag/auth-ui/client";
import { MdOutlineSend, MdLogout } from "react-icons/md";

import { useInternalWallet } from "@/providers/InternalWalletProvider";

export default function WalletAction() {
  const { signOut } = useAuth();
  const { swap } = useInternalWallet();

  return (
    <>
      <button
        type="button"
        className="flex items-center space-x-2 p-2"
        onClick={swap}
      >
        <MdOutlineSend className="-rotate-45" />
        <span>Swap</span>
      </button>
      <button
        type="button"
        className="flex items-center space-x-2 p-2"
        onClick={signOut}
      >
        <MdLogout />
        <span>Disconnect Wallet</span>
      </button>
    </>
  );
}
