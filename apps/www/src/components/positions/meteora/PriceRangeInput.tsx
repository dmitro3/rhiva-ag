import DLMM from "@meteora-ag/dlmm";
import { Chart, Tooltip } from "chart.js";
import { useCallback, useMemo } from "react";
import type { Pair } from "@rhiva-ag/dex-api";
import { BarElement, CategoryScale, LinearScale } from "chart.js";
import { type BinLiquidity, getPriceOfBinByBinId } from "@meteora-ag/dlmm";

import PriceRangeInput from "../PriceRangeInput";

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip);

type PriceRangeInputProps = {
  pool: Pair;
  sides: boolean[];
  label?: string;
  amount?: number;
  value: [number, number];
  activeBin: BinLiquidity;
  liquidityRatio?: [number, number];
  curveType: "Spot" | "Curve" | "BidAsk";
  onChange: (value: [number, number]) => void;
};

export default function MeteoraPriceRangeInput({
  pool,
  activeBin,
  ...props
}: PriceRangeInputProps) {
  const currentPrice = useMemo(
    () => parseFloat(activeBin.pricePerToken),
    [activeBin],
  );

  const priceToIndex = useCallback(
    (price: number) => DLMM.getBinIdFromPrice(price, pool.binStep, false),
    [pool],
  );
  const indexToPrice = useCallback(
    (tick: number) =>
      parseFloat(
        DLMM.getPricePerLamport(
          pool.baseToken.decimals,
          pool.quoteToken.decimals,
          getPriceOfBinByBinId(tick, pool.binStep).toNumber(),
        ),
      ),
    [pool],
  );

  return (
    <PriceRangeInput
      {...props}
      pool={pool}
      currentPrice={currentPrice}
      indexToPrice={indexToPrice}
      priceToIndex={priceToIndex}
    />
  );
}
