import { createSolanaRpc } from "@solana/kit";
import type { Connection } from "@solana/web3.js";
import { LiquidityBookServices, MODE } from "@saros-finance/dlmm-sdk";

import { OrcaDLMM } from "./orca";
import { SarosDLMM } from "./saros";
import { MeteoraDLMM } from "./meteora";
import type { OrcaLegacyDLMM } from "./orca-legacy";

export { OrcaDLMM, SarosDLMM, MeteoraDLMM };

export class DLMM {
  readonly rpc: ReturnType<typeof createSolanaRpc>;

  readonly orca: OrcaDLMM;
  readonly saros: SarosDLMM;
  readonly meteora: MeteoraDLMM;

  constructor(connection: Connection) {
    this.rpc = createSolanaRpc(connection.rpcEndpoint);
    this.orca = new OrcaDLMM(this.rpc);
    this.saros = new SarosDLMM(
      new LiquidityBookServices({
        mode: MODE.MAINNET,
        options: {
          rpcUrl: connection.rpcEndpoint,
        },
      }),
    );
    this.meteora = new MeteoraDLMM();
  }

  get orcaLegacy(): OrcaLegacyDLMM {
    throw new Error("unimplemented");
  }
}
