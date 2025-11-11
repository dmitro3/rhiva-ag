import clsx from "clsx";
import debounce from "lodash.debounce";
import { IoChevronDown } from "react-icons/io5";
import { useCallback, useEffect, useMemo, useState } from "react";

import Image from "./Image";

type TokenInputProps = {
  value: number;
  label?: string;
  balance?: number;
  token: {
    symbol: string;
    icon: string;
    mint: string;
    decimals: number;
  };
  onSwitch?: () => void;
  onChange: (value: number) => void;
  inputAttrs?: React.ComponentProps<"input">;
} & Omit<React.ComponentProps<"div">, "onChange">;

export default function TokenInput({
  label,
  token,
  value,
  balance,
  onChange,
  onSwitch,
  inputAttrs,
  ...props
}: TokenInputProps) {
  const [rawInput, setRawInput] = useState<string | number>(value ?? "");
  const change = useMemo(() => debounce(onChange, 500), [onChange]);
  const onChangeText = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      setRawInput(raw);
      const value = parseFloat(raw);
      if (!Number.isNaN(value)) change(value);
    },
    [change],
  );

  useEffect(() => {
    if (value) setRawInput(value);
  }, [value]);

  return (
    <div
      {...props}
      className={clsx(
        "flex flex-col space-y-2 bg-primary/5 border border-primary/10 backdrop-blur-3xl rounded-md p-4 focus-within:border-primary",
        props.className,
      )}
    >
      <p className="text-gray">{label}</p>
      <div className="flex items-center space-x-4">
        <button
          type="button"
          className="flex items-center space-x-2 bg-primary/10 px-2 py-2 rounded-md"
          onClick={onSwitch}
        >
          <Image
            src={token.icon}
            width={24}
            height={24}
            alt={token.symbol}
            className="size-6 rounded-full"
          />
          <p className="font-medium">{token.symbol}</p>
          <IoChevronDown />
        </button>
        <input
          {...inputAttrs}
          value={rawInput}
          placeholder="0"
          className={clsx(
            "w-full flex-1 bg-transparent text-2xl text-end font-medium border-none",
            inputAttrs?.className,
          )}
          onChange={onChangeText}
        />
      </div>
      {balance != null && (
        <p className="text-gray text-xs">Balance: {balance}</p>
      )}
    </div>
  );
}
