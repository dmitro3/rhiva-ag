"use client";
import clsx from "clsx";
import { MdLogin, MdLogout } from "react-icons/md";
import { useAuth } from "@rhiva-ag/auth-ui/client";
import { useWallet } from "@solana/wallet-adapter-react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";

import Image from "../Image";
import { truncateString } from "@/lib";
import CopyButton from "../CopyButton";
import WalletAction from "./WalletAction";
import { useMounted } from "@/hooks/useMounted";
import InternalWalletAction from "./InternalWalletlAction";
import { useInternalWallet } from "@/providers/InternalWalletProvider";

export default function LoginButton() {
  const mounted = useMounted();
  const { wallet } = useWallet();
  const { user, signIn } = useAuth();
  const { create, switchWallet, internalWallet, externalWallet } =
    useInternalWallet();

  return (
    <div className="flex items-center space-x-2">
      {user ? (
        <>
          <div className="border border-primary/50 text-light px-2 py-1 rounded-md">
            {user.xp} XP
          </div>
          <Popover>
            <PopoverButton className="flex items-center space-x-2 bg-primary/10 px-2 py-1 rounded-md outline-none">
              {mounted &&
                (wallet && user.wallet.external ? (
                  <Image
                    src={wallet.adapter.icon}
                    width={16}
                    height={16}
                    alt={wallet.adapter.name}
                    className="rounded-md"
                  />
                ) : (
                  <Image
                    src="/favicon.ico"
                    width={16}
                    height={16}
                    alt="Rhiva"
                    className="rounded-md"
                  />
                ))}
              <span className="text-light">
                {truncateString(user.wallet.id)}
              </span>
              <CopyButton
                as="div"
                content={user.wallet.id}
              />
            </PopoverButton>
            <PopoverPanel
              anchor="bottom start"
              className="w-56 mt-4  flex flex-col bg-dark border border-white/10 rounded-md z-10
            [&_button]:flex [&_button]:items-center [&_button]:space-x-2 [&_button]:p-2 hover:[&_button]:text-primary hover:[&_button]:bg-black"
            >
              <div className="flex items-center space-x-4 px-2">
                <div className="flex items-center space-x-2">
                  <div
                    className={clsx(
                      "size-2 rounded-full",
                      user.wallet.external ? "bg-red-500" : "bg-primary",
                    )}
                  />
                  <p className="text-nowrap">
                    {user.wallet.external ? "Not Signed" : "Signed"}
                  </p>
                </div>

                <button
                  type="button"
                  className="!bg-transparent text-nowrap"
                  onClick={() => {
                    if (internalWallet)
                      switchWallet(
                        user.wallet.id === externalWallet?.id
                          ? internalWallet
                          : externalWallet,
                      );
                    else create();
                  }}
                >
                  {user.wallet.external ? (
                    <>
                      <MdLogin />
                      <span>Sign</span>
                    </>
                  ) : (
                    <>
                      <MdLogout />
                      <span>Sign Out</span>
                    </>
                  )}
                </button>
              </div>
              {user.wallet.external ? (
                <WalletAction />
              ) : (
                <InternalWalletAction />
              )}
            </PopoverPanel>
          </Popover>
        </>
      ) : (
        <button
          type="button"
          className="bg-primary text-black px-4 py-1.5 rounded"
          onClick={() => signIn(true)}
        >
          Login
        </button>
      )}
    </div>
  );
}
