"use client";

import clsx from "clsx";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/assets/logo.png";
import { usePathname } from "next/navigation";
import { FaDiscord, FaXTwitter, FaYoutube } from "react-icons/fa6";

import { useAuth } from "@/hooks/useAuth";
import IcMessage from "@/assets/icons/ic_message";
import IcSettings from "@/assets/icons/ic_settings";

type NavItem = {
  name: string;
  path: string;
  protected?: boolean;
  icon: React.ElementType;
};

type Social = {
  name: string;
  link: string;
  icon: React.ElementType;
};

type SideNavProps = {
  expanded?: boolean;
  setExpanded?: React.Dispatch<React.SetStateAction<boolean>>;
  onClose?: () => void;
} & React.ComponentProps<"div">;

export default function SideNav({
  onClose,
  expanded,
  setExpanded,
  ...props
}: SideNavProps) {
  const pathname = usePathname();
  const { signIn, isAuthenticated } = useAuth();

  const navItems: NavItem[] = [
    { name: "Messages", icon: IcMessage, path: "/messages", protected: true },
    { name: "Settings", icon: IcSettings, path: "/settings", protected: true },
  ];

  const socials: Social[] = [
    {
      name: "Twitter",
      link: "",
      icon: FaXTwitter,
    },
    {
      name: "Discord",
      link: "",
      icon: FaDiscord,
    },
    {
      name: "Youtube",
      link: "",
      icon: FaYoutube,
    },
  ];

  return (
    <div
      {...props}
      className={clsx("relative z-100", props.className)}
    >
      <div className="lt-sm:fixed lt-sm:inset-0 flex flex-col z-50">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-black/50 -z-10 sm:hidden"
          onClick={() => onClose?.()}
        />
        <div
          className={clsx(
            props.className,
            "flex-1 flex flex-col lt-sm:space-y-12  lt-sm:bg-dark-secondary lt-sm:max-w-5/10",
          )}
        >
          <Link
            href="/"
            className="py-4 sm:hidden"
          >
            <Image
              src={Logo}
              width={156}
              height={61}
              alt="Rhiva"
            />
          </Link>

          <nav className={clsx(props.className, "flex-1 flex flex-col")}>
            <ul className="flex-1 flex flex-col space-y-4 p-4 sm:items-center xl:items-start">
              {navItems.map((navItem) => {
                const selected = navItem.path === pathname;

                return (
                  <li key={navItem.name}>
                    <Link
                      href={navItem.path}
                      className={clsx(
                        "flex items-center p-2 space-x-4 py-4",
                        selected
                          ? "text-primary fill-primary"
                          : "text-white/70 fill-white/70",
                      )}
                      onMouseEnter={() => setExpanded?.(true)}
                      onNavigate={(event) => {
                        if (navItem.protected) {
                          if (isAuthenticated) return;
                          event.preventDefault();
                          return signIn();
                        }
                      }}
                    >
                      <navItem.icon className="size-6" />
                      <span
                        className={clsx(
                          "lt-sm:inline lt-xl:hidden",
                          !expanded && "xl:hidden",
                        )}
                      >
                        {navItem.name}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <ul
              className={clsx(
                "flex space-x-4 p-4 sm:hidden xl:flex",
                !expanded && "xl:invisible",
              )}
            >
              {socials.map((navItem) => {
                return (
                  <li
                    key={navItem.name}
                    className="flex-1"
                  >
                    <Link
                      href={navItem.link}
                      className="flex items-center p-2"
                    >
                      <navItem.icon className="size-6 text-white/70" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
