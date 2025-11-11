import type { Raydium } from "@raydium-io/raydium-sdk-v2";

import { RaydiumCLMM } from "./raydium";

export { RaydiumCLMM };

export class CLMM {
  raydium: RaydiumCLMM;

  constructor(raydium?: Raydium) {
    this.raydium = new RaydiumCLMM(raydium);
  }

  setRaydium(raydium: RaydiumCLMM) {
    this.raydium = raydium;
    return this;
  }
}
