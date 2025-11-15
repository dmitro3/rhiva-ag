import clsx from "clsx";
import { format } from "util";
import { useRouter } from "next/navigation";
import { useAuth } from "@rhiva-ag/auth-ui/client";

import Decimal from "../Decimal";
import IcAiIcon from "@/assets/icons/ic_ai";
import { currencyIntlArgs } from "@/constants/format";

type TokenInfoProps = {
  mint: string;
  price: number;
  holders: number;
  volume: number;
  liquidity: number;
  marketCap: number;
} & React.ComponentProps<"div">;

export default function TokenInfo({
  mint,
  volume,
  price,
  holders,
  liquidity,
  marketCap,
  ...props
}: TokenInfoProps) {
  const router = useRouter();
  const { isAuthenticated, signIn } = useAuth();

  return (
    <div
      {...props}
      className={clsx(
        "grid grid-cols-3 gap-2 md:flex md:flex-wrap md:gap-x-4",
        props.className,
      )}
    >
      <div className="md:flex-1 max-w-48">
        <button
          type="button"
          className="flex items-center space-x-2 border border-green fill-green px-2 py-1 rounded-md"
          onClick={() => {
            if (isAuthenticated)
              router.push(format("/ai?prompt=Analyse this token %s", mint));
            else signIn();
          }}
        >
          <IcAiIcon
            width={18}
            height={18}
          />
          <span className="text-green">Ask Ai</span>
        </button>
      </div>
      <div className="md:flex-1 max-w-48">
        <p className="text-xs text-gray md:text-sm">Current Liquidity</p>
        <Decimal
          value={liquidity}
          intlArgs={currencyIntlArgs}
        />
      </div>
      <div className="md:flex-1 max-w-48">
        <p className="text-xs text-gray md:text-sm">Market Cap</p>
        <Decimal
          value={marketCap}
          intlArgs={currencyIntlArgs}
        />
      </div>
      <div className="md:flex-1 max-w-48">
        <p className="text-xs text-gray md:text-sm">Volume</p>
        <Decimal
          value={volume}
          intlArgs={currencyIntlArgs}
        />
      </div>
      <div className="md:flex-1 max-w-48">
        <p className="text-xs text-gray md:text-sm">Price</p>
        <Decimal
          value={price}
          intlArgs={currencyIntlArgs}
        />
      </div>
      <div className="md:flex-1 max-w-48">
        <p className="text-xs text-gray md:text-sm">Holders</p>
        <Decimal value={holders} />
      </div>
    </div>
  );
}
