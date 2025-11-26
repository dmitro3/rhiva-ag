import { format } from "util";

let cachedFonts: Array<{
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600 | 700;
}> | null = null;

export async function loadFonts(origin: string) {
  if (cachedFonts) return cachedFonts;

  const fontNames = [
    ["Roboto-Regular.ttf", 400],
    ["Roboto-Medium.ttf", 500],
    ["Roboto-SemiBold.ttf", 600],
    ["Roboto-Bold.ttf", 700],
    ["Gobold.otf", 700],
  ] as const;
  cachedFonts = await Promise.all(
    fontNames.map(async ([file, weight]) => {
      const res = await fetch(new URL(format("/fonts/%s", file), origin), {
        cache: "force-cache",
      });
      const data = await res.arrayBuffer();
      return { name: file.split("-")[0].split(".")[0]!, data, weight };
    }),
  );

  return cachedFonts;
}

export const getNumberColor = (value: number) =>
  value >= 0 ? (value === 0 ? undefined : "#39FF14") : "#ef4444";
export const getCardBackground = (value: number) =>
  value >= 0 ? "proft" : "loss";
