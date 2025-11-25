export const getNumberColor = (value: number) =>
  value >= 0 ? (value === 0 ? undefined : "text-primary") : "text-red-500";
