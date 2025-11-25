import { DexApi } from "@rhiva-ag/dex-api";
import { isNull, or } from "drizzle-orm";
import {
  buildConflictUpdateColumns,
  createDB,
  mints,
} from "@rhiva-ag/datasource";

import { getEnv } from "../src/env";

(async () => {
  const db = createDB(getEnv("DATABASE_URL"));
  const tokens = await db.query.mints.findMany({
    where: or(isNull(mints.name), isNull(mints.symbol), isNull(mints.image)),
  });
  const dexApi = new DexApi();
  if (tokens.length > 0) {
    const jupTokens = await dexApi.jup.token.list({
      category: "search",
      query: tokens.map((token) => token.id).join(","),
    });
    console.log(jupTokens, { depth: null });
    if (jupTokens.length > 0) {
      await db
        .insert(mints)
        .values(
          jupTokens.map((token) => ({
            id: token.id,
            name: token.name,
            image: token.icon,
            symbol: token.symbol,
            decimals: token.decimals,
            tokenProgram: token.tokenProgram,
          })),
        )
        .onConflictDoUpdate({
          target: [mints.id],
          set: buildConflictUpdateColumns(mints, [
            "name",
            "symbol",
            "decimals",
            "image",
          ]),
        });
    }
  }
})();
