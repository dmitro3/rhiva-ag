// biome-ignore-all lint/performance/noImgElement: ssr
import moment from "moment";
import { format } from "util";
import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";

import {
  compactCurrencyIntlArgs,
  percentageIntlArgs,
} from "@/constants/format";

let cachedFonts: Array<{
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600 | 700;
}> | null = null;

async function loadFonts(origin: string) {
  if (cachedFonts) return cachedFonts;

  const fontNames = [
    ["Roboto-Regular.ttf", 400],
    ["Roboto-Medium.ttf", 500],
    ["Roboto-SemiBold.ttf", 600],
    ["Roboto-Bold.ttf", 700],
  ] as const;

  cachedFonts = await Promise.all(
    fontNames.map(async ([file, weight]) => {
      const res = await fetch(new URL(format("/fonts/%s", file), origin), {
        cache: "force-cache",
      });
      const data = await res.arrayBuffer();
      return { name: "Roboto", data, weight };
    }),
  );

  return cachedFonts;
}

const Text = <T extends React.ElementType>({
  children,
  as = "p",
  ...props
}: React.ComponentProps<T> & React.PropsWithChildren & { as?: T }) => {
  const As = as;
  return (
    <As
      {...props}
      style={{ fontFamily: "Roboto", ...props.style, margin: 0 }}
    >
      {children}
    </As>
  );
};

type PoolData = {
  name: string;
  price?: number;
  apr?: number;
  tvl?: number;
  volume24h: number;
  baseFee: number;
  maxFee: number;
  dex: string;
  baseToken: {
    name: string;
    symbol: string;
    icon: string;
  };
  quoteToken: {
    name: string;
    symbol: string;
    icon: string;
  };
};

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const data = searchParams.get("data");
  const percentageIntl = Intl.NumberFormat("en-US", {
    ...percentageIntlArgs,
    maximumFractionDigits: 4,
  });
  const currencyIntl = Intl.NumberFormat("en-US", {
    ...compactCurrencyIntlArgs,
    maximumFractionDigits: 2,
  });
  const decimalIntl = Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  });

  if (data) {
    const pool: PoolData = JSON.parse(
      Buffer.from(decodeURIComponent(data), "base64").toString("utf-8"),
    );
    return new ImageResponse(
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
        }}
      >
        <img
          aria-hidden
          width="100%"
          height="100%"
          src={format("%s/og-bg.jpg", origin)}
          style={{ position: "absolute", inset: 0, zIndex: -10 }}
        />
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            padding: 16,
            color: "white",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", rowGap: 16 }}>
            <div style={{ display: "flex", position: "relative" }}>
              <img
                src={pool.baseToken.icon}
                width={32}
                height={32}
                alt={pool.baseToken.symbol}
                style={{
                  borderRadius: 100,
                  boxShadow: "-1px 0 2px rgba(57, 255, 20, 0.6)",
                }}
              />
              <img
                src={pool.quoteToken.icon}
                width={32}
                height={32}
                alt={pool.quoteToken.symbol}
                style={{
                  marginLeft: -8,
                  borderRadius: 100,
                  boxShadow: "-1px 0 2px rgba(57, 255, 20, 0.6)",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                flexGrow: 1,
                columnGap: 8,
                paddingLeft: 8,
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    columnGap: 8,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                    {pool.name}
                  </Text>
                  <img
                    src={format("%s/ic_%s.png", origin, pool.dex)}
                    width={16}
                    height={16}
                    alt={pool.dex}
                  />
                </div>
                <Text style={{ color: "rgba(255,255,255,0.5)" }}>
                  {pool.baseToken.name} & {pool.quoteToken.name}
                </Text>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  textAlign: "end",
                  alignItems: "flex-end",
                }}
              >
                {pool.price && (
                  <Text style={{ fontSize: 18 }}>
                    {decimalIntl.format(pool.price)} {pool.quoteToken.symbol}/
                    {pool.baseToken.symbol}
                  </Text>
                )}
                {pool.apr && (
                  <Text
                    style={{
                      color: pool.apr > 0 ? "#39FF14" : "#ef4444",
                    }}
                  >
                    {percentageIntl.format(pool.apr)}
                  </Text>
                )}
              </div>
            </div>
          </div>
          <div
            style={{
              flexGrow: 1,
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                flexGrow: 1,
                rowGap: 16,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  gap: 8,
                  maxWidth: "75%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                  }}
                >
                  {pool.tvl && (
                    <div
                      style={{
                        flexGrow: 1,
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <Text
                        as="small"
                        style={{ color: "rgba(255,255,255,0.5)" }}
                      >
                        TVL
                      </Text>
                      <Text style={{ fontWeight: "bold" }}>
                        {currencyIntl.format(pool.tvl)}
                      </Text>
                    </div>
                  )}
                  <div
                    style={{
                      flexGrow: 1,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <Text
                      as="small"
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        textAlign: "end",
                      }}
                    >
                      24h Vol
                    </Text>
                    <Text style={{ fontWeight: "bold", textAlign: "end" }}>
                      {currencyIntl.format(pool.volume24h)}
                    </Text>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      flexGrow: 1,
                      display: "flex",
                      flexDirection: "column",
                      textAlign: "end",
                    }}
                  >
                    <Text
                      as="small"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      Base Fee
                    </Text>
                    <Text style={{ fontWeight: "bold" }}>
                      {percentageIntl.format(pool.baseFee)}
                    </Text>
                  </div>
                  <div
                    style={{
                      flexGrow: 1,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <Text
                      as="small"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      Max Fee
                    </Text>
                    <Text style={{ fontWeight: "bold" }}>
                      {percentageIntl.format(pool.maxFee)}
                    </Text>
                  </div>
                </div>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", columnGap: 8 }}
              >
                <img
                  aria-hidden
                  width={16}
                  height={16}
                  src={format("%s/favicon.ico", origin)}
                />
                <Text
                  as="small"
                  style={{ fontWeight: "medium" }}
                >
                  rhiva.fun
                </Text>
              </div>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", rowGap: 16 }}
            >
              <div
                style={{
                  columnGap: 4,
                  minWidth: 160,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.5rem 0",
                  borderRadius: "9999px",
                  color: "black",
                  background: "linear-gradient(90deg, #39FF14, #5093FF)",
                  boxShadow: "0 0 0 4px black, 0 0 0 5px #39FF14",
                }}
              >
                <Text as="span">Trade on Rhiva</Text>
                <img
                  width={16}
                  height={16}
                  aria-hidden
                  src={format("%s/arrow-right.png", origin)}
                />
              </div>
              <Text
                as="small"
                style={{ color: "rgba(255,255,255,0.5)", textAlign: "end" }}
              >
                {moment().format("D MMM YYYY HH:mm [UTC]")}
              </Text>
            </div>
          </div>
        </div>
      </div>,
      {
        width: 576,
        height: 288,
        fonts: await loadFonts(origin),
      },
    );
  }

  return NextResponse.error();
}
