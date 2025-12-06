import type { Connection } from "@solana/web3.js";

import { Jupiter } from "./jupiter";

export { Jupiter };

export class SwapAggregator {
  jupiter: Jupiter;

  constructor(connection: Connection) {
    this.jupiter = new Jupiter("https://lite-api.jup.ag", connection);
  }
}
