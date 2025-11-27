"use client";

type DecimalProps<T extends React.ElementType> = {
  as?: T;
  prefix?: string;
  suffix?: string;
  disableTruncate?: boolean;
  value: number | string;
  minValue?: number;
  intlArgs?: Intl.NumberFormatOptions;
  truncateStyle?: React.CSSProperties;
} & React.ComponentPropsWithoutRef<T>;

export default function Decimal<T extends React.ElementType>({
  intlArgs,
  value,
  as,
  minValue,
  prefix,
  suffix,
  disableTruncate = true,
  truncateStyle,
  ...props
}: DecimalProps<T>) {
  const As = as || "span";
  const intl = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
    ...intlArgs,
  });

  const [wholeNumber, fractionalNumber] = value.toString().split(/\./g);
  if (minValue && Number(value) < minValue && Number(value) > 0)
    return (
      <span {...props}>
        {prefix}&lt;{intl.format(minValue)}
        {suffix}
      </span>
    );
  if (fractionalNumber && Number(wholeNumber) === 0 && !disableTruncate) {
    const truncate = fractionalNumber.slice(1, fractionalNumber.length - 3);
    return (
      <As {...props}>
        {prefix}
        {intl.format(Number(wholeNumber)).split(/\./g)[0]}.
        {fractionalNumber.slice(0, 3)}
        {truncate.length > 0 && (
          <sub style={truncateStyle}>{truncate.length}</sub>
        )}
        {fractionalNumber.slice(fractionalNumber.length - 3)}
        {suffix}
      </As>
    );
  } else
    return (
      <As {...props}>
        {prefix}
        {intl.format(Number(value))}
        {suffix}
      </As>
    );
}
