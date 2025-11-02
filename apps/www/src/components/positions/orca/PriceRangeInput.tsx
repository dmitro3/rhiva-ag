import { Chart, Tooltip } from "chart.js";
import type { Pair } from "@rhiva-ag/dex-api";
import { use, useCallback, useMemo } from "react";
import type { Account, Address } from "@solana/kit";
import type { Whirlpool } from "@orca-so/whirlpools-client";
import { BarElement, CategoryScale, LinearScale } from "chart.js";

import PriceRangeInput from "../PriceRangeInput";

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip);

type PriceRangeInputProps = {
  pool: Pair;
  sides: boolean[];
  amount?: number;
  label?: string;
  showInput?: boolean;
  value: [number, number];
  liquidityRatio?: [number, number];
  whirlpool: Account<Whirlpool, Address>;
  onChange: (value: [number, number]) => void;
};

export default function OrcaPriceRangeInput({
  pool,
  whirlpool,
  ...props
}: PriceRangeInputProps) {
  const { tickIndexToPrice, priceToTickIndex } = use(
    import(
      "@orca-so/whirlpools-core/dist/browser/orca_whirlpools_core_js_bindings"
    ),
  );
  const currentPrice = useMemo(
    () =>
      tickIndexToPrice(
        whirlpool.data.tickCurrentIndex,
        pool.baseToken.decimals,
        pool.quoteToken.decimals,
      ),
    [whirlpool, pool, tickIndexToPrice],
  );

  const priceToIndex = useCallback(
    (price: number, decimal0: number, decimal1: number) =>
      priceToTickIndex(price, decimal0, decimal1),
    [priceToTickIndex],
  );
  const indexToPrice = useCallback(
    (tick: number, decimal0: number, decimal1: number) =>
      tickIndexToPrice(tick, decimal0, decimal1),
    [tickIndexToPrice],
  );

  return (
    <PriceRangeInput
      {...props}
      curveType="Spot"
      pool={pool}
      showInput={false}
      currentPrice={currentPrice}
      indexToPrice={indexToPrice}
      priceToIndex={priceToIndex}
    />
  );
}
