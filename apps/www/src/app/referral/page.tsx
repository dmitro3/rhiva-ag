"use client";
import { format } from "util";
import { useMemo } from "react";

import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/layout/Header";
import CopyButton from "@/components/CopyButton";

export default function ReferralPage() {
  const { user } = useAuth();
  const referralLink = useMemo(
    () => format("%s?referral=%s", window.location.origin, user.referralCode),
    [user.referralCode],
  );

  return (
    <div className="flex-1 flex flex-col space-y-4 overflow-y-scroll lt-sm:fixed lt-sm:inset-0 lt-md:z-50 lt-sm:bg-dark">
      <Header
        canBack
        className="sticky top-0 z-10"
      />
      <div className="p-4">
        <div className="flex flex-col space-y-8 bg-white/3 border border-white/10 backdrop-blur-xl p-4 rounded-xl sm:max-w-4xl">
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold">Referral</h1>
            <p className="text-gray">
              Share your referral link and track your referral program
              performance
            </p>
          </div>
          <div className="flex flex-col space-y-6">
            <div className="flex flex-col space-y-4">
              <p className="text-base font-medium">Your Referral Link</p>
              <div className="flex items-center space-x-4">
                <div className="flex-1 border border-gray/50 p-3 rounded-xl">
                  <p className="text-gray">{referralLink}</p>
                </div>
                <CopyButton
                  content={referralLink}
                  copyIconAttrs={{ size: 24 }}
                  className="text-gray"
                />
              </div>
            </div>
            <div className="flex flex-col space-y-4">
              <p className="text-base font-medium">Your Referral Code</p>
              <div className="flex items-center space-x-4">
                <div className="flex-1 border border-gray/50 p-3 rounded-xl">
                  <p className="text-gray">{user.referralCode}</p>
                </div>
                <CopyButton
                  content={user.referralCode}
                  copyIconAttrs={{ size: 24 }}
                  className="text-gray"
                />
              </div>
            </div>
            <div className="flex space-x-8">
              <div className="flex-1 flex flex-col space-y-4 bg-white/3 border border-gray/50 p-4 rounded-xl">
                <p className="text-base">Referral Stats</p>
                <div className="flex flex-col">
                  <p className="text-gray">Total Invited</p>
                  <p className="text-xl font-medium">{user.totalRefer}</p>
                </div>
              </div>
              <div className="flex-1 flex flex-col space-y-4 bg-white/3 border border-gray/50 p-4 rounded-xl">
                <p className="text-base">Referral Earn</p>
                <div className="flex flex-col">
                  <p className="text-gray">Total Earnings</p>
                  <p className="text-xl font-medium">{user.referXp} XP</p>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-gray">
            Share your access code with your friends and <br /> earn 10% of
            their XP!
          </p>
        </div>
      </div>
    </div>
  );
}
