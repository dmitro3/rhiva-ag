import { useMemo } from "react";
import { useAuth } from "@rhiva-ag/auth-ui/client";

import IcPup from "@/assets/icons/tiers/ic_pup.svg";
import IcDuke from "@/assets/icons/tiers/ic_duke.svg";
import IcLord from "@/assets/icons/tiers/ic_lord.svg";
import IcKing from "@/assets/icons/tiers/ic_king.svg";
import IcQueen from "@/assets/icons/tiers/ic_queen.svg";
import IcRipple from "@/assets/icons/tiers/ic_ripple.svg";
import IcSurfer from "@/assets/icons/tiers/ic_surfer.svg";
import IcKnight from "@/assets/icons/tiers/ic_knight.svg";
import IcGuardian from "@/assets/icons/tiers/ic_guardian.svg";
import IcStreamer from "@/assets/icons/tiers/ic_streamer.svg";
import type { StaticImport } from "next/dist/shared/lib/get-img-props";

export type Tier = {
  name: string;
  stars: number;
  icon: StaticImport | string;
  xpRange: [number, number];
};

export function useTiers() {
  const { user } = useAuth();

  const tiers: Tier[] = useMemo(
    () => [
      { name: "Pup", xpRange: [0, 4_999], stars: 0, icon: IcPup },
      { name: "Ripple", xpRange: [5_000, 14_999], stars: 0, icon: IcRipple },
      {
        name: "Streamer",
        xpRange: [15_000, 34_999],
        stars: 0,
        icon: IcStreamer,
      },
      { name: "Surfer", xpRange: [35_000, 69_999], stars: 0, icon: IcSurfer },
      {
        name: "Guardian",
        xpRange: [70_000, 124_999],
        stars: 1,
        icon: IcGuardian,
      },
      { name: "Knight", xpRange: [125_000, 224_999], stars: 1, icon: IcKnight },
      { name: "Duke", xpRange: [225_000, 374_999], stars: 1, icon: IcDuke },
      { name: "Lord", xpRange: [375_000, 599_999], stars: 2, icon: IcLord },
      { name: "Queen", xpRange: [600_000, 999_999], stars: 3, icon: IcQueen },
      { name: "King", xpRange: [1_000_000, Infinity], stars: 3, icon: IcKing },
    ],
    [],
  );

  const tier = useMemo(() => {
    const index = tiers.findIndex(
      ({ xpRange: [start, end] }) => user?.xp >= start && user?.xp <= end,
    );
    const currentTier = tiers[index];
    const nextTier = tiers[index + 1];
    return { currentTier, nextTier };
  }, [user, tiers]);

  const stars = useMemo(
    () =>
      tiers
        .filter(({ xpRange: [, end] }) => user?.xp >= end)
        .reduce((acc, cur) => acc + cur.stars, 0),
    [user, tiers],
  );

  return { tiers, ...tier, user, stars };
}
