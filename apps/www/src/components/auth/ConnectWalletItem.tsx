import Image from "next/image";
import type { WalletName } from "@solana/wallet-adapter-base";
import { useWallet, type Wallet } from "@solana/wallet-adapter-react";

type ConnectWalletItemProps = {
  wallet: Wallet;
};

export default function ConnectWalletItem({ wallet }: ConnectWalletItemProps) {
  const { select } = useWallet();

  return (
    <button
      type="button"
      className="flex items-center space-x-2 border border-white/10 p-2 rounded-md"
      onClick={() => select(wallet.adapter.name as WalletName)}
    >
      <Image
        src={wallet.adapter.icon}
        width={24}
        height={24}
        alt={wallet.adapter.name}
      />
      <span>{wallet.adapter.name}</span>
    </button>
  );
}
