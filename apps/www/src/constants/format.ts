export const currencyIntlArgs: Intl.NumberFormatOptions = {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

export const compactCurrencyIntlArgs: Intl.NumberFormatOptions = {
  style: "currency",
  currency: "USD",
  notation: "compact",
  compactDisplay: "short",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

export const percentageIntlArgs: Intl.NumberFormatOptions = {
  style: "unit",
  unit: "percent",
  unitDisplay: "narrow",
  signDisplay: "exceptZero",
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
};
