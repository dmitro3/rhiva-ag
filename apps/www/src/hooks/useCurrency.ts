import { useMemo } from "react";

export const useCurrencies = () => {
  const currencies = useMemo(
    () => [
      { label: "USD", value: null },
      { label: "SOL", value: "native" },
    ],
    [],
  );

  return currencies;
};
