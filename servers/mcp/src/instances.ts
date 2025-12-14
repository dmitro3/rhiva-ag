import path from "path";
import { DexApi } from "@rhiva-ag/dex-api";
import { createDB } from "@rhiva-ag/datasource";
import Coingecko from "@coingecko/coingecko-typescript";

import { getEnv } from "./env";

export const __srcdir =
  process.env.NODE_ENV === "production"
    ? path.join(process.cwd(), "mcp")
    : __dirname.replace("src", "");

export const dexApi = new DexApi();
export const db = createDB(getEnv("DATABASE_URL"));
export const coingecko = new Coingecko({
  environment: "pro",
  proAPIKey: getEnv("COINGECKO_API_KEY"),
});
