import { Configuration, SwapApi } from "@jup-ag/api";
import type { Connection } from "@solana/web3.js";

import { Jupiter } from "./jupiter";

export { Jupiter };

export class SwapAggregator {
  jupiter: Jupiter;

  constructor(connection: Connection) {
    this.jupiter = new Jupiter(
      new SwapApi(
        new Configuration({
          apiKey: "",
          basePath: "https://lite-api.jup.ag/swap/v1",
        }),
      ),
      connection,
    );
  }
}
