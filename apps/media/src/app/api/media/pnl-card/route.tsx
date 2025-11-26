// biome-ignore-all lint/performance/noImgElement: ssr
import moment from "moment";
import { format } from "util";
import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";

import Text from "@/components/Text";
import { getCardBackground, getNumberColor, loadFonts } from "@/utils";
import {
  compactCurrencyIntlArgs,
  currencyIntlArgs,
  percentageIntlArgs,
} from "@/constants/format";

type Pnl = {
  baseToken: {
    symbol: string;
  };
  quoteToken: {
    symbol: string;
  };
  pnlUsd: number;
  amountUsd: number;
  updatedAt: string;
  createdAt: string;
  state: "closed";
  hideProfit?: boolean;
  hideBalance?: boolean;
};

const grey = "#737373";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const data = searchParams.get("data");
  const percentageIntl = Intl.NumberFormat("en-US", {
    ...percentageIntlArgs,
    maximumFractionDigits: 4,
  });
  const currencyIntl = Intl.NumberFormat("en-US", {
    ...compactCurrencyIntlArgs,
    maximumFractionDigits: 6,
  });

  const currencyWithSignIntl = new Intl.NumberFormat("en-US", {
    ...currencyIntlArgs,
    signDisplay: "exceptZero",
  });

  if (data) {
    const randomId = Math.floor(Math.random() * 6) + 1;
    const pnl: Pnl = JSON.parse(
      Buffer.from(decodeURIComponent(data), "base64").toString("utf-8"),
    );

    const name = [pnl.baseToken.symbol, pnl.quoteToken.symbol].join("-");
    const pnlPercentage = (pnl.pnlUsd / pnl.amountUsd) * 100;

    const duration = (() => {
      if (pnl.state === "closed")
        return moment.duration(
          moment(pnl.updatedAt).diff(moment(pnl.createdAt)),
        );
      return moment.duration(moment().diff(moment(pnl.createdAt)));
    })();

    const time = format(
      "%s:%s:%s",
      String(Math.floor(duration.asHours())).padStart(2, "0"),
      String(duration.minutes()).padStart(2, "0"),
      String(duration.seconds()).padStart(2, "0"),
    );

    return new ImageResponse(
      <div
        style={{
          width: 576,
          height: 288,
          display: "flex",
          position: "relative",
          flexDirection: "column",
        }}
      >
        <img
          alt="Pnl Card"
          style={{
            objectFit: "fill",
          }}
          src={format(
            "%s/bg/pnls/%s/%d.jpeg",
            origin,
            getCardBackground(pnl.pnlUsd),
            randomId,
          )}
        />
        <div
          style={{
            rowGap: 4,
            padding: 16,
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            top: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <Text style={{ color: grey, textTransform: "uppercase" }}>
              Time
            </Text>
            <Text style={{ color: "white", fontSize: 32, fontWeight: 500 }}>
              {time}
            </Text>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <Text style={{ color: grey, textTransform: "uppercase" }}>
              Pool
            </Text>
            <Text style={{ color: "white", fontSize: 32, fontWeight: 500 }}>
              {name}
            </Text>
          </div>
          {!pnl.hideProfit && (
            <Text
              style={{
                fontSize: 64,
                fontWeight: 900,
                fontFamily: "Gobold",
                color: getNumberColor(pnl.pnlUsd),
              }}
            >
              {currencyWithSignIntl.format(pnl.pnlUsd)}
            </Text>
          )}
          <div style={{ display: "flex", flexDirection: "row", columnGap: 64 }}>
            {!pnl.hideBalance && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                }}
              >
                <Text style={{ color: grey, textTransform: "uppercase" }}>
                  TVL
                </Text>
                <Text style={{ color: "white", fontWeight: 600 }}>
                  {currencyIntl.format(pnl.amountUsd)}
                </Text>
              </div>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
              }}
            >
              <Text style={{ color: grey, textTransform: "uppercase" }}>
                PNL
              </Text>
              <Text
                style={{
                  color: getNumberColor(pnlPercentage),
                  fontWeight: 600,
                }}
              >
                {percentageIntl.format(pnlPercentage)}
              </Text>
            </div>
          </div>
        </div>
      </div>,
      {
        width: 576,
        height: 288,
        fonts: await loadFonts(origin),
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      },
    );
  }

  return NextResponse.error();
}
