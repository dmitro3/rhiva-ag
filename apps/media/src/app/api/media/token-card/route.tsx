// biome-ignore-all lint/performance/noImgElement: ssr
import moment from "moment";
import { format } from "util";
import { ImageResponse } from "next/og";
import { type NextRequest, NextResponse } from "next/server";

import { loadFonts } from "@/utils";
import Text from "@/components/Text";
import {
  compactCurrencyIntlArgs,
  percentageIntlArgs,
} from "@/constants/format";

type TokenData = {
  name: string;
  symbol: string;
  icon: string;
  liquidity: number;
  usdPrice: number;
  stats24h: {
    buyOrganicVolume: number;
    sellOrganicVolume: number;
  };
  stats5m: {
    priceChange: number;
  };
  mcap: number;
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

  if (data) {
    const token: TokenData = JSON.parse(
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
          <div style={{ display: "flex", alignItems: "center", columnGap: 8 }}>
            <img
              src={token.icon}
              width={32}
              height={32}
              alt={token.symbol}
              style={{
                borderRadius: 100,
                boxShadow: "-1px 0 2px rgba(57, 255, 20, 0.6)",
              }}
            />
            <div
              style={{
                display: "flex",
                flexGrow: 1,
                columnGap: 8,
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                  {token.symbol}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.5)" }}>
                  {token.name}
                </Text>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  textAlign: "end",
                }}
              >
                <Text style={{ fontSize: 18 }}>
                  {currencyIntl.format(token.usdPrice)}
                </Text>
                <Text
                  style={{
                    color:
                      token.stats5m.priceChange > 0 ? "#39FF14" : "#ef4444",
                  }}
                >
                  {percentageIntl.format(token.stats5m.priceChange)}
                </Text>
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
                      MCap
                    </Text>
                    <Text style={{ fontWeight: "bold" }}>
                      {currencyIntl.format(token.mcap)}
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
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        textAlign: "end",
                      }}
                    >
                      24h Vol
                    </Text>
                    <Text style={{ fontWeight: "bold", textAlign: "end" }}>
                      {currencyIntl.format(
                        token.stats24h.buyOrganicVolume +
                          token.stats24h.sellOrganicVolume,
                      )}
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
                    }}
                  >
                    <Text
                      as="small"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      Liquidity
                    </Text>
                    <Text style={{ fontWeight: "bold" }}>
                      {currencyIntl.format(token.liquidity)}
                    </Text>
                  </div>
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
                      Net Buy Vol
                    </Text>
                    <Text style={{ fontWeight: "bold" }}>
                      {currencyIntl.format(token.stats24h.buyOrganicVolume)}
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
        width: 512,
        height: 288,
        fonts: await loadFonts(origin),
      },
    );
  }

  return NextResponse.error();
}
