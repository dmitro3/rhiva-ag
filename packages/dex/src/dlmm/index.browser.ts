import { createSolanaRpc } from "@solana/kit";
import type { Connection } from "@solana/web3.js";
import type { Raydium } from "@raydium-io/raydium-sdk-v2";
import { AnchorProvider, type Wallet } from "@coral-xyz/anchor";

import { RaydiumCLMM } from "./raydium";
import { MeteoraDLMM } from "./meteora";
import { OrcaLegacyDLMM } from "./orca-legacy";
import {
  WhirlpoolContext,
  buildWhirlpoolClient,
  ORCA_WHIRLPOOL_PROGRAM_ID,
} from "@orca-so/whirlpools-sdk";

export class DLMM {
  readonly rpc: ReturnType<typeof createSolanaRpc>;

  readonly meteora: MeteoraDLMM;
  readonly raydium: RaydiumCLMM;
  readonly orcaLegacy: OrcaLegacyDLMM;

  constructor(connection: Connection, raydium?: Raydium) {
    this.rpc = createSolanaRpc(connection.rpcEndpoint);
    this.meteora = new MeteoraDLMM();
    this.raydium = new RaydiumCLMM(raydium);
    const provider = new AnchorProvider(connection, {} as Wallet, {});
    this.orcaLegacy = new OrcaLegacyDLMM(
      buildWhirlpoolClient(
        WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID),
      ),
    );
  }
}
