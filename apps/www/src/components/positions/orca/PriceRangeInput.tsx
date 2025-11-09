import Decimal from "decimal.js";
import { Chart, Tooltip } from "chart.js";
import type { Pair } from "@rhiva-ag/dex-api";
import { useCallback, useMemo } from "react";
import { PriceMath } from "@orca-so/whirlpools-sdk";
import type { Account, Address } from "@solana/kit";
import { BarElement, CategoryScale, LinearScale } from "chart.js";
import type { Whirlpool } from "@orca-so/whirlpools-sdk/whirlpools-client";

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
  const currentPrice = useMemo(
    () =>
      PriceMath.tickIndexToPrice(
        whirlpool.data.tickCurrentIndex,
        pool.baseToken.decimals,
        pool.quoteToken.decimals,
      ).toNumber(),
    [whirlpool, pool],
  );

  const priceToIndex = useCallback(
    (price: number, decimal0: number, decimal1: number) =>
      PriceMath.priceToTickIndex(new Decimal(price), decimal0, decimal1),
    [],
  );
  const indexToPrice = useCallback(
    (tick: number, decimal0: number, decimal1: number) =>
      PriceMath.tickIndexToPrice(tick, decimal0, decimal1).toNumber(),
    [],
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
