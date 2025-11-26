"use client";
import Image from "next/image";
import { useCookies } from "react-cookie";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Description,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

import Logo from "@/assets/logo.png";

export default function LegalModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, setCookie] = useCookies(["legal"]);
  const showLegalDialog = useMemo(
    () => searchParams.get("show_legal_dialog") != null,
    [searchParams],
  );

  return (
    <Dialog
      open={showLegalDialog}
      onClose={() => router.replace(pathname)}
      className="relative z-100"
    >
      <div className="fixed inset-0 flex md:items-center md:justify-center ">
        <DialogBackdrop className="absolute inset-0 bg-black/50 backdrop-blur-sm -z-10" />
        <DialogPanel className="max-w-xl md:max-h-xl flex flex-col bg-black text-light overflow-y-scroll rounded-2xl">
          <header className="flex flex-col items-center sticky top-0 bg-black backdrop-blur-xl py-4">
            <Image
              src={Logo}
              width={128}
              height={64}
              alt="Rhiva"
            />
            <DialogTitle className="text-3xl text-primary font-semibold">
              Beta Terms & Conditions
            </DialogTitle>
            <p className="text-gray">Last Updated [Sat 25th, Oct 2025]</p>
          </header>
          <div className="flex flex-col space-y-8 p-4">
            <Description>
              Welcome to the Rhiva. We’re excited to have you join us as we test
              and improve our liquidity yield aggregator on Solana. Before you
              dive in, please read these simple terms so we’re all on the same
              page.
            </Description>
            <ol className="flex flex-col space-y-4 list-decimal list-inside">
              <li>
                <span className="text-white text-lg font-semibold">
                  Product Beta
                </span>
                <p>
                  Rhiva is currently in beta which means things are still
                  experimental. Features may change, break, or even disappear
                  without notice. Joining the beta doesn’t guarantee you’ll
                  always have access to future versions.
                </p>
              </li>

              <li>
                <span className="text-white text-lg font-semibold">
                  No Financial Advice
                </span>
                <p>
                  Rhiva helps you explore liquidity and yield opportunities on
                  Solana, but we are not giving financial advice. All choices
                  you make (adding liquidity, farming, etc.) are 100% your
                  responsibility.
                </p>
              </li>
              <li>
                <span className="text-white text-lg font-semibold">
                  Risks You Should Know
                </span>
                <p>
                  DeFi and blockchain come with risks: token volatility, smart
                  contract bugs, or even total loss of funds. Since this is a
                  beta product, expect possible glitches, downtime, or
                  unexpected behavior. You’re using Rhiva at your own risk.
                </p>
              </li>
              <li>
                <span className="text-white text-lg font-semibold">
                  Security Check (But No Guarantees)
                </span>
                <p>
                  Rhiva’s contracts have been reviewed by third-party security
                  platforms 🔒. This adds an extra layer of protection, but it
                  does not guarantee 100% safety. Always do your own research
                  and only risk what you can afford to lose.
                </p>
              </li>
              <li>
                <span className="text-white text-lg font-semibold">
                  Who Can Join
                </span>
                <p>
                  You must be 18+ (or the legal age in your country). Make sure
                  your local laws allow you to use blockchain/DeFi services.
                </p>
              </li>
              <li>
                <span className="text-white text-lg font-semibold">
                  No Promises
                </span>
                <p>
                  Rhiva is provided “as is” during beta. We don’t promise
                  uptime, specific yields, or perfect performance.
                </p>
              </li>
              <li>
                <span className="text-white text-lg font-semibold">
                  Liability
                </span>
                <p>
                  We (the Rhiva team, partners, or affiliates) are not
                  responsible for: Lost tokens or funds Hacks, bugs, or
                  unexpected issues Missed profits or financial losses
                </p>
              </li>
              <li>
                <span className="text-white text-lg font-semibold">
                  Feedback Rights
                </span>
                <p>
                  Any feedback you give us can be used to improve Rhiva. By
                  sending it, you let us use it freely (but don’t worry, you
                  still own your ideas).
                </p>
              </li>
              <li>
                <span className="text-white text-lg font-semibold">
                  Updates
                </span>
                <p>
                  We may change or stop the beta at any time. If these Terms
                  change, continuing to use Rhiva means you accept the new
                  version.
                </p>
              </li>
              <li>
                <span className="text-white text-lg font-semibold">
                  Data Collection &amp; Usage
                </span>
                <p>
                  We value your privacy and are committed to being transparent
                  about the information we client and how it is used.
                </p>
                <ol className="flex flex-col px-4 space-y-2 list-decimal list-inside">
                  <li>
                    <span className="text-white text-base font-semibold">
                      Google Sign In
                    </span>
                    <p>
                      We receive your email address and full name from Google,
                      which are used as unique identifiers in our database for
                      future authentication. We will never share your email or
                      send newsletters without your explicit consent. Your email
                      address and full name will never be shared with any third
                      party.
                    </p>
                  </li>
                  <li>
                    <span className="text-white text-base font-semibold">
                      Facebook Sign In
                    </span>
                    <p>
                      We receive your email address and full name from Facebook,
                      which are used as unique identifiers in our database for
                      future authentication. We will never share your email or
                      send newsletters without your explicit consent. Your email
                      address and full name will never be shared with any third
                      party.
                    </p>
                  </li>
                  <li>
                    <span className="text-white text-base font-semibold">
                      Cookies for Authentication
                    </span>
                    <p>
                      We use cookies to manage user authentication and maintain
                      secure sessions. These cookies help verify your identity
                      when you log in, keep you signed in as you navigate
                      through the website, and ensure your account remains
                      secure. No personally identifiable information is stored
                      directly in these cookies.
                    </p>
                  </li>
                  <li>
                    <span className="text-white text-base font-semibold">
                      Google Analytics
                    </span>
                    <p>
                      We use Google Analytics to collect anonymized usage data
                      and understand how users interact with our website. This
                      helps us improve performance and user experience. Google
                      Analytics may record information such as your device type,
                      browser, approximate geographic location, and pages
                      visited. All data is aggregated and does not include
                      personally identifiable information.
                    </p>
                    <p>
                      We do not collect or store any other personal data beyond
                      what is necessary for authentication and analytics. You
                      can manage or disable cookies through your browser
                      settings at any time.
                    </p>
                  </li>
                </ol>
              </li>
              <li>
                <span className="text-white text-lg font-semibold">
                  Acknowledgment
                </span>
                <p>By using Rhiva Beta, you agree that you:</p>
                <ul>
                  <li>✅ Understand it’s experimental</li>
                  <li>✅ Accept the risks involved</li>
                  <li>
                    ✅ Know third-party checks reduce risks but don’t eliminate
                    them
                  </li>
                  <li>✅ Take full responsibility for your own use</li>
                </ul>
              </li>
            </ol>
            <button
              type="button"
              className="bg-primary text-black p-3 rounded"
              onClick={() => {
                router.replace(pathname);
                setCookie("legal", "true");
              }}
            >
              I agree
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
