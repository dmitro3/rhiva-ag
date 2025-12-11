"use client";
import clsx from "clsx";
import type z from "zod";
import Image from "next/image";
import { useCookies } from "react-cookie";
import { useTranslations } from "next-intl";
import { useAuth } from "@rhiva-ag/auth-ui/client";
import type { extraAuthSchema } from "@rhiva-ag/trpc";

import ClientOnly from "../ClientOnly";
import Banner from "@/assets/bg/banner.svg";

type Extra = z.infer<typeof extraAuthSchema>;

export default function HeroSection(props: React.ComponentProps<"section">) {
  const { user } = useAuth();
  const t = useTranslations("HomePage.HeroSection");
  const [cookies] = useCookies<keyof Extra, Partial<Extra>>(["displayName"]);

  return (
    <section
      {...props}
      className={clsx(
        props.className,
        "relative overflow-hidden flex items-center bg-white/5 backdrop-blur-2xl border border-white/10 rounded-xl min-h-[280px] md:min-h-[320px] lg:min-h-[400px]",
      )}
    >
      <div className="relative z-10 flex flex-col justify-center p-6 space-y-4 lt-xl:max-w-6/10 md:px-8 lg:px-12 max-w-2xl">
        <ClientOnly>
          <p className="text-sm text-gray-400 md:text-base lg:text-lg">
            {t("greetings", {
              name: user?.displayName || cookies.displayName || "User",
            })}
          </p>
        </ClientOnly>

        <div className="flex flex-col space-y-2 md:space-y-3">
          <h1 className="text-2xl font-bold text-primary sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl">
            {t("title")}
          </h1>

          <p className="text-base text-white/90 sm:text-lg md:text-xl lg:text-2xl font-medium">
            {t("subtitle")}
          </p>

          <p className="text-sm text-gray-400 max-w-xl pt-2 lt-md:hidden md:text-base lg:text-lg ">
            {t("description")}
          </p>
        </div>
      </div>

      <div className="absolute right-0 top-0 h-full w-1/2 md:w-3/5 lg:w-1/2 pointer-events-none">
        <Image
          src={Banner}
          alt="Welcome Banner"
          fill
          className="object-cover object-left"
          priority
        />
      </div>

      <div className="absolute top-0 right-1/4 w-64 h-64 bg-primary/30 blur-[100px] rounded-full pointer-events-none" />
    </section>
  );
}
