import clsx from "clsx";
import Image from "next/image";
import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { Auth } from "@rhiva-ag/auth-ui/server";
import { ToastContainer } from "react-toastify";
import { NextIntlClientProvider } from "next-intl";
import "es-arraybuffer-base64/Uint8Array.prototype.toBase64";

import "@unocss/reset/tailwind.css";
import "rc-slider/assets/index.css";

import "./globals.css";
import Provider from "@/providers";
import Line from "@/assets/bg/line.png";
import Logo from "@/assets/logo-sm.png";
import NavBar from "@/components/layout/NavBar";
import OnboardingWrapper from "@/components/onboarding";

const defaultFont = Roboto({
  subsets: ["latin"],
  variable: "--font-noto-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Rhiva | Liquidity Aggregator for seamless LP",
  description:
    "Experience Rhiva Beta, the all-in-one liquidity aggregator. Provide liquidity across multiple dexes.",
  openGraph: {
    type: "website",
    url: "https://beta.rhiva.fun",
    images: ["https://beta.rhiva.fun/banner.jpg"],
  },
};

export default function RootLayout({ children }: React.PropsWithChildren) {
  return (
    <NextIntlClientProvider>
      <Auth
        logo={
          <Image
            src={Logo}
            width={24}
            height={24}
            alt="Rhiva"
            className="self-center"
          />
        }
        firebaseOptions={{
          projectId: "apexflixpro",
          measurementId: "G-VP6SR8TBRZ",
          authDomain: "auth.rhiva.fun",
          messagingSenderId: "389673955403",
          storageBucket: "apexflixpro.firebasestorage.app",
          appId: "1:389673955403:web:2528a7a190f23a8acaddce",
          apiKey: "AIzaSyCH0Vaw4h1dlIigWu7FzdxJx3mjiGwSzpA",
        }}
      >
        <Provider>
          <html
            lang="en"
            style={defaultFont.style}
            className={clsx(defaultFont.variable, defaultFont.className)}
          >
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1, maximum-scale=1"
            />

            <body className="fixed inset-0 flex flex-col bg-dark text-white overflow-y-scroll lt-md:text-sm">
              <OnboardingWrapper>
                <Image
                  src={Line.src}
                  width={1643}
                  height={260}
                  alt="Background Line"
                  className="w-full absolute inset-x-0 z-0"
                />
                <div className="flex-1 flex z-10 lt-sm:flex-col-reverse overflow-y-scroll">
                  <NavBar />
                  {children}
                </div>
              </OnboardingWrapper>
              <ToastContainer theme="dark" />
            </body>
          </html>
        </Provider>
      </Auth>
    </NextIntlClientProvider>
  );
}
