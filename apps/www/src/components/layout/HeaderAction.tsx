"use client";

import clsx from "clsx";
import Link from "next/link";
import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { MdContentCopy, MdLogout, MdOutlineSend } from "react-icons/md";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";

import Image from "../Image";
import { truncateString } from "@/lib";
import { useAuth } from "@/hooks/useAuth";
import { useMounted } from "@/hooks/useMounted";

export default function HeaderAction(props: React.ComponentProps<"div">) {
  const mounted = useMounted();
  const { wallet } = useWallet();
  const { user, setUser, signIn, signOut } = useAuth();

  const onSignOut = useCallback(
    () => signOut().then(() => setUser(undefined)),
    [signOut, setUser],
  );
  return (
    <div
      {...props}
      className={clsx("flex items-center sm:space-x-8", props.className)}
    >
      <Link
        href="?show_legal_dialog=true"
        className="text-light underline decoration-dashed lt-sm:hidden"
      >
        Legal
      </Link>
      <div className="flex items-center space-x-2">
        {user ? (
          <>
            <button
              type="button"
              className="border border-primary/50 text-light px-2 py-1 rounded-md"
            >
              {user.xp} XP
            </button>
            <Popover className="relative">
              <PopoverButton className="flex items-center space-x-2 bg-primary/10 px-2 py-1 rounded-md outline-none">
                {mounted &&
                  (wallet ? (
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
                <MdContentCopy className="text-white/60" />
              </PopoverButton>
              <PopoverPanel className="mt-4 absolute inset-x-0 bg-dark border border-white/10 rounded-md">
                <button
                  type="button"
                  className="flex items-center space-x-2 p-2"
                >
                  <MdOutlineSend className="-rotate-45" />
                  <span>Send</span>
                </button>
                <button
                  type="button"
                  className="flex items-center space-x-2 p-2"
                  onClick={onSignOut}
                >
                  <MdLogout />
                  <span>Logout</span>
                </button>
              </PopoverPanel>
            </Popover>
          </>
        ) : (
          <button
            type="button"
            className="bg-primary text-black px-4 py-1.5 rounded"
            onClick={signIn}
          >
            Login
          </button>
        )}
      </div>
    </div>
  );
}
