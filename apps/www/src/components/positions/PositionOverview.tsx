import clsx from "clsx";
import { useMemo } from "react";

import Image from "../Image";
import { percentageIntlArgs } from "@/constants/format";

type PositionOverviewProps = {
  estimatedYield: number;
  tokens: { symbol: string; icon: string }[];
} & React.ComponentProps<"div">;
export default function PositionOverview({
  estimatedYield,
  tokens,
  ...props
}: PositionOverviewProps) {
  const intl = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        ...percentageIntlArgs,
        maximumFractionDigits: 8,
        signDisplay: "never",
      }),
    [],
  );

  return (
    <div
      className={clsx(
        "flex flex-col space-y-2 border border-white/10 backdrop-blur p-4 rounded-md",
        props.className,
      )}
    >
      <div className="flex justify-between">
        <div className="flex items-center space-x-2 text-light">
          <span>Estimated Yield</span>
          <div className="text-gray bg-primary/10 px-2 rounded">24H</div>
        </div>
        <p>{intl.format(estimatedYield)}</p>
      </div>
      <div className="flex justify-between">
        <p>Deposit</p>
        <div className="flex space-x-2">
          {tokens.map((token) => (
            <div
              key={token.symbol}
              className="flex items-center space-x-1"
            >
              <span>50%</span>
              <Image
                width={16}
                height={16}
                src={token.icon}
                alt={token.symbol}
                className="rounded-full"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
