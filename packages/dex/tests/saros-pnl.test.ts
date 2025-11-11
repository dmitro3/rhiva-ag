import { Connection } from "@solana/web3.js";
import { LiquidityBookServices, MODE } from "@saros-finance/dlmm-sdk";

import { getEnv } from "./env";
import { SarosPnLCalculator } from "../src/pnl-calculator/saros";

describe("saros", () => {
  let connection: Connection;
  let service: LiquidityBookServices;

  beforeAll(async () => {
    connection = new Connection(getEnv("SOLANA_RPC_URL"));
    service = new LiquidityBookServices({
      mode: MODE.MAINNET,
    });
  });

  test("getPnL", async () => {
    const pnl = new SarosPnLCalculator(connection, service);
    const result = await pnl.fromSignature(
      "2NJa1XEkf1Zh5pLkCcqmVNrHWBDLVYh1ijxSxNs136ST6BpMeXRN8ZnUeWA9ifZE5CqFi3ZGDzdzoZFhyHTEKKtN",
    );
    console.log(result, { depth: null });
  });
});
