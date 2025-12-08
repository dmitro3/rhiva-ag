"use client";

import clsx from "clsx";
import Link from "next/link";

import LoginButton from "./LoginButton";

export default function HeaderAction(props: React.ComponentProps<"div">) {
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
      <LoginButton />
    </div>
  );
}
