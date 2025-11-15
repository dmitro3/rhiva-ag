import clsx from "clsx";
import { format } from "util";
import RangeSlider from "rc-slider";
import { Bar } from "react-chartjs-2";
import { Chart, Tooltip } from "chart.js";
import type { Pair } from "@rhiva-ag/dex-api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarElement, CategoryScale, LinearScale } from "chart.js";

import Decimal from "../Decimal";
import NumberInput from "../NumberInput";
import { generateLiquidityDistribution } from "@/lib";

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip);

type RangeAutoFillOption = {
  label: string;
  value: [number, number];
};

type PriceRangeInputProps = {
  pool: Pair;
  sides: boolean[];
  amount?: number;
  label?: string;
  showInput?: boolean;
  value: [number, number];
  currentPrice: number;
  liquidityRatio?: [number, number];
  curveType?: "Spot" | "Curve" | "BidAsk";
  onChange: (value: [number, number]) => void;
  priceToIndex: (price: number, decimal0: number, decimal1: number) => number;
  indexToPrice: (price: number, decimal0: number, decimal1: number) => number;
};

export default function PriceRangeInput({
  amount = 0,
  label,
  onChange,
  pool,
  value,
  sides,
  liquidityRatio,
  currentPrice,
  priceToIndex,
  curveType = "Spot",
  showInput = true,
}: PriceRangeInputProps) {
  const [range, setRange] = useState([0, 1]);
  const [priceRange, setPriceRange] = useState(value);
  const [lowerPriceChange, upperPriceChange] = value;
  const [binStep, setBinStep] = useState(69);
  const [minPrice, setMinPrice] = useState(() => {
    return currentPrice + currentPrice * lowerPriceChange;
  });
  const [maxPrice, setMaxPrice] = useState(() => {
    return currentPrice + currentPrice * upperPriceChange;
  });

  const intl = useMemo(
    () => new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }),
    [],
  );

  const priceStep = useMemo(() => {
    return currentPrice * (pool.binStep / 10_000);
  }, [pool, currentPrice]);

  const autoFillOptions: RangeAutoFillOption[] = useMemo(
    () => [
      { label: "1%", value: [-0.01, 0.01] },
      { label: "5%", value: [-0.05, 0.05] },
      { label: "10%", value: [-0.1, 0.1] },
    ],
    [],
  );

  const liquidities = useMemo(
    () => generateLiquidityDistribution(amount, binStep, curveType),
    [binStep, amount, curveType],
  );

  const maxLiquidity = useMemo(() => Math.max(...liquidities), [liquidities]);

  const relativeLiquidities = useMemo(
    () => liquidities.map((value) => value / maxLiquidity),
    [liquidities, maxLiquidity],
  );

  const labels = useMemo(() => {
    const labels: string[] = [];
    const stepCount = liquidities.length - 1;

    const ratioStep = Math.pow(maxPrice / minPrice, 1 / stepCount);

    for (let index = 0; index <= stepCount; index++) {
      const price = minPrice * Math.pow(ratioStep, index);
      labels.push(price.toPrecision(4));
    }

    return labels;
  }, [minPrice, maxPrice, liquidities.length]);

  const onMinPriceChange = useCallback(
    (price: number) => {
      const lowerPriceChange = (currentPrice - price) / currentPrice;
      const priceChanges: [number, number] = [
        -lowerPriceChange,
        upperPriceChange,
      ];
      setMinPrice(price);
      onChange(priceChanges);
      setPriceRange(priceChanges);
    },
    [currentPrice, upperPriceChange, onChange],
  );

  const onMaxPriceChange = useCallback(
    (price: number) => {
      const upperPriceChange = (price - currentPrice) / currentPrice;
      const priceChanges: [number, number] = [
        lowerPriceChange,
        upperPriceChange,
      ];
      setMaxPrice(price);
      onChange(priceChanges);
      setPriceRange(priceChanges);
    },
    [currentPrice, lowerPriceChange, onChange],
  );

  const onPriceChange = useCallback(
    ([lowerPriceChange, upperPriceChange]: [number, number]) => {
      const minPrice = currentPrice + currentPrice * lowerPriceChange;
      const maxPrice = currentPrice + currentPrice * upperPriceChange;

      setMinPrice(minPrice);
      setMaxPrice(maxPrice);
      setPriceRange([lowerPriceChange, upperPriceChange]);
      onChange([lowerPriceChange, upperPriceChange]);
    },
    [currentPrice, onChange],
  );

  useEffect(() => {
    const minPrice = currentPrice + currentPrice * lowerPriceChange;
    const maxPrice = currentPrice + currentPrice * upperPriceChange;
    const binIds: number[] = [
      priceToIndex(minPrice, pool.baseToken.decimals, pool.quoteToken.decimals),
      priceToIndex(maxPrice, pool.baseToken.decimals, pool.quoteToken.decimals),
    ];
    const minBinId = Math.min(...binIds);
    const maxBinId = Math.max(...binIds);
    const binStep = maxBinId - minBinId;
    setBinStep(Math.min(binStep, 128));
    setMaxPrice(maxPrice);
    setMinPrice(minPrice);
  }, [pool, currentPrice, lowerPriceChange, upperPriceChange, priceToIndex]);

  return (
    <div className="flex flex-col space-y-2">
      {label && <p className="text-light-secondary">Price Range</p>}
      <div className="flex flex-col space-y-4 sm:space-y-8">
        <p className="text-xs text-white/75 text-center">
          Current Price: <Decimal value={currentPrice} />
          &nbsp;
          {pool.quoteToken.symbol}/{pool.baseToken.symbol}
        </p>
        <div className="relative flex flex-col max-h-24 sm:max-h-48">
          <Bar
            data={{
              labels,
              datasets: [
                {
                  data: relativeLiquidities,
                  categoryPercentage: 1.0,
                  backgroundColor: (ctx) => {
                    if (liquidityRatio) {
                      const index = ctx.dataIndex;
                      const dataLength = ctx.dataset.data.length;
                      const [left] = liquidityRatio;
                      const leftMax = Math.floor(dataLength * left);

                      return index <= leftMax ? "#00D897" : "#6A0DAD";
                    }
                    const colors = ["#00D897", "#6A0DAD"];
                    const enabledIndex = sides.indexOf(true);

                    return colors[enabledIndex];
                  },
                },
                {
                  data: Array(liquidities.length).fill(1),
                  backgroundColor: "#737373",
                  borderSkipped: true,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  displayColors: false,
                  titleColor: "red",
                  footerColor: "red",
                  callbacks: {
                    title: () => "",
                    label: (ctx) => [
                      "Price",
                      intl.format(parseFloat(ctx.label)),
                    ],
                    afterLabel: (ctx) => {
                      const tokens = [pool.baseToken, pool.quoteToken];

                      if (liquidityRatio) {
                        const index = ctx.dataIndex;
                        const dataLength = ctx.dataset.data.length;
                        const [left] = liquidityRatio;
                        const leftMax = Math.floor(dataLength * left);
                        const enabled = sides[index <= leftMax ? 0 : 1];
                        const sideIndex =
                          index <= leftMax
                            ? enabled
                              ? 0
                              : 1
                            : enabled
                              ? 1
                              : 0;

                        const token = tokens[sideIndex];

                        return format(
                          "%s %s",
                          intl.format(liquidities[index]),
                          token.symbol,
                        );
                      }

                      const index = ctx.dataIndex;
                      const dataLength = ctx.dataset.data.length;
                      const midpoint = dataLength / 2;
                      const sideIndex = Math.floor(index / midpoint);
                      const token = tokens[sideIndex];
                      return format(
                        "%s %s",
                        intl.format(liquidities[index]),
                        token.symbol,
                      );
                    },
                  },
                },
              },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: {
                    maxRotation: 0,
                    color: "#888",
                    font: { size: 12 },
                  },
                  stacked: true,
                },
                y: {
                  min: 0,
                  max: 1,
                  stacked: true,
                  grid: { display: false },
                  ticks: { display: false },
                },
              },
            }}
          />
          <RangeSlider
            range
            max={1}
            step={0.01}
            value={range}
            className="absolute inset-x-0 bottom-5"
            onChange={(val) => {
              const range = val as [number, number];
              const [lowerDelta, upperDelta] = range;
              const [lower, upper] = priceRange;
              setRange(range);
              onChange([lower - lower * lowerDelta, upper * upperDelta]);
            }}
          />
        </div>
        <div className="flex flex-col space-y-4">
          <div
            className={clsx(
              "flex items-center space-x-8",
              showInput && "justify-stretch",
            )}
          >
            <div
              className={clsx(
                "flex space-x-2 bg-primary/10 p-2 rounded-md",
                showInput && "flex-1",
              )}
            >
              {autoFillOptions.map((option) => {
                const selected = value.every(
                  (value, index) => value === option.value[index],
                );

                return (
                  <button
                    key={option.label}
                    type="button"
                    className={clsx(
                      "flex-1 text-xs px-2 py-1 rounded-md",
                      selected ? "bg-primary text-black" : "text-light",
                    )}
                    onClick={() => onPriceChange(option.value)}
                  >
                    <span className="text-nowrap">± {option.label}</span>
                  </button>
                );
              })}
            </div>
            {showInput && (
              <div className="flex-1 flex items-center space-x-2 border border-white/10 px-2 rounded-md focus-within:border-primary">
                <p className="lt-sm:text-xs">Bins</p>
                <input
                  type="number"
                  placeholder="0"
                  value={binStep}
                  disabled
                  className="w-full p-2 text-end"
                />
              </div>
            )}
          </div>
          <div className="flex-1 flex justify-stretch space-x-8">
            <NumberInput
              label="Min Price"
              value={minPrice}
              step={priceStep}
              onChange={onMinPriceChange}
            />
            <NumberInput
              label="Max Price"
              value={maxPrice}
              step={priceStep}
              onChange={onMaxPriceChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
