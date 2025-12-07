import type { Connection } from "@solana/web3.js";
import type { Raydium } from "@raydium-io/raydium-sdk-v2";

import { DLMM } from "./dlmm";
import { CLMM } from "./clmm";
import { SwapAggregator } from "./swap-ag";

export * from "./dlmm";
export * from "./clmm";
export * from "./swap-ag";

export default class Dex {
  dlmm: DLMM;
  clmm: CLMM;
  swap: SwapAggregator;

  constructor(
    readonly connection: Connection,
    raydium?: Raydium,
  ) {
    this.clmm = new CLMM(raydium);
    this.dlmm = new DLMM(connection);
    this.swap = new SwapAggregator();
  }
}
