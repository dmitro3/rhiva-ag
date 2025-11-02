"use client";
import clsx from "clsx";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MdArrowBack, MdMenu } from "react-icons/md";

import SideNav from "./SideNav";
import HeaderAction from "./HeaderAction";
import LogoSmall from "@/assets/logo-sm.png";
import Link from "next/link";

type HeaderProps = {
  canBack?: boolean;
  title?: string;
} & React.ComponentProps<"header">;

export default function Header({ canBack, title, ...props }: HeaderProps) {
  const router = useRouter();
  const [showSideNav, setShowSideNav] = useState(false);

  return (
    <>
      <header
        {...props}
        className={clsx(
          "flex justify-between items-center p-4 lt-sm:border-b lt-sm:border-transparent lt-sm:[border-image:linear-gradient(to_right,#000,theme(colors.primary),#000)_1]",
          props.className,
        )}
      >
        <div className="flex items-center space-x-4">
          {canBack ? (
            <button
              type="button"
              className="flex items-center space-x-2"
              onClick={() => router.back()}
            >
              <MdArrowBack size={24} />
              <span>Back</span>
            </button>
          ) : title ? (
            <h1 className="uppercase text-lg font-bold">{title}</h1>
          ) : (
            <>
              <Link href="/">
                <Image
                  src={LogoSmall}
                  width={20}
                  height={20}
                  alt="Rhiva"
                  className="sm:hidden m-auto"
                />
              </Link>
              <button
                type="button"
                className="sm:hidden"
                onClick={() => setShowSideNav(true)}
              >
                <MdMenu
                  color="white"
                  className="text-xl"
                />
              </button>
            </>
          )}
        </div>
        <HeaderAction />
      </header>
      {showSideNav && (
        <SideNav
          className="sm:hidden"
          onClose={() => setShowSideNav(false)}
        />
      )}
    </>
  );
}
