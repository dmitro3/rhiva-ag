"use client";
import Image from "next/image";
import type React from "react";
import { useEffect, useState } from "react";
import { useAuth } from "@rhiva-ag/auth-ui/client";
import { TabGroup, TabPanels, TabList, Tab } from "@headlessui/react";

import IcLogo from "../../assets/logo.png";
import ReferralForm from "./ReferralForm";
import DisplayNameForm from "./DisplayNameForm";

export default function OnboardingWrapper({
  children,
}: React.PropsWithChildren) {
  const { user, signIn } = useAuth();
  const [selectedPage, setSelectedPage] = useState(0);

  useEffect(() => {
    if (!user) signIn(false);
  }, [user, signIn]);

  if (user && user.displayName) return children;
  else
    return (
      <div className="fixed inset-0 bg-dark">
        <div className="relative size-full">
          <div className="size-full flex flex-col justify-center bg-dark/75 lt-sm:px-8 sm:items-center">
            <div className="flex-1 flex flex-col justify-center ">
              <Image
                src={IcLogo}
                width={4120}
                height={1328}
                alt="Logo"
                className="w-2xl"
              />
            </div>
            <div className="flex-1 flex flex-col justify-center lt-sm:space-y-32 sm:min-w-md">
              <TabGroup
                selectedIndex={selectedPage}
                onChange={setSelectedPage}
              >
                <TabList>
                  <Tab />
                  <Tab />
                </TabList>
                <TabPanels>
                  <ReferralForm onNext={() => setSelectedPage(1)} />
                  <DisplayNameForm />
                </TabPanels>
              </TabGroup>
            </div>
          </div>
          <Image
            src="/onboarding.png"
            alt="Onboarding"
            width={1536}
            height={1024}
            className="size-full absolute inset-0 object-cover -z-10 lt-sm:[object-position:60%_0%]"
          />
        </div>
      </div>
    );
}
