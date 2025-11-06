import type { Connection } from "@solana/web3.js";
import type { Raydium } from "@raydium-io/raydium-sdk-v2";

import { SwapAggregator } from "./swap-ag";
import { DLMM } from "./dlmm/index.browser";

export * from "./utils";
export * from "./swap-ag";
export * from "./dlmm/index.browser";

export default class Dex {
  dlmm: DLMM;
  swap: SwapAggregator;

  constructor(
    readonly connection: Connection,
    raydium?: Raydium,
  ) {
    this.dlmm = new DLMM(connection, raydium);
    this.swap = new SwapAggregator(connection);
  }
}
