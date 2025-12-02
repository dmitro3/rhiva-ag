import type { Connection, PublicKey } from "@solana/web3.js";
import type { Raydium } from "@raydium-io/raydium-sdk-v2";

import { CLMM } from "./clmm";
import { SwapAggregator } from "./swap-ag";
import { DLMM } from "./dlmm/index.browser";

export * from "./clmm";
export * from "./swap-ag";
export * from "./dlmm/index.browser";

export default class Dex {
  dlmm: DLMM;
  clmm: CLMM;
  swap: SwapAggregator;

  constructor(
    readonly connection: Connection,
    raydium?: Raydium,
    owner?: PublicKey | null,
  ) {
    this.clmm = new CLMM(raydium);
    this.dlmm = new DLMM(connection, owner);
    this.swap = new SwapAggregator(connection);
  }
}
