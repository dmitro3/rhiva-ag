import { createSolanaRpc } from "@solana/kit";
import type { Raydium } from "@raydium-io/raydium-sdk-v2";
import type { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, type Wallet } from "@coral-xyz/anchor";

import { RaydiumCLMM } from "./raydium";
import { MeteoraDLMM } from "./meteora";
import { OrcaLegacyDLMM } from "./orca-legacy";
import {
  WhirlpoolContext,
  buildWhirlpoolClient,
} from "@orca-so/whirlpools-sdk";

export class DLMM {
  readonly rpc: ReturnType<typeof createSolanaRpc>;

  readonly meteora: MeteoraDLMM;
  readonly raydium: RaydiumCLMM;
  readonly orcaLegacy: OrcaLegacyDLMM;

  constructor(
    connection: Connection,
    raydium?: Raydium,
    owner?: PublicKey | null,
  ) {
    this.rpc = createSolanaRpc(connection.rpcEndpoint);
    this.meteora = new MeteoraDLMM();
    this.raydium = new RaydiumCLMM(raydium);
    const provider = new AnchorProvider(
      connection,
      { publicKey: owner } as Wallet,
      {},
    );
    this.orcaLegacy = new OrcaLegacyDLMM(
      buildWhirlpoolClient(WhirlpoolContext.withProvider(provider)),
    );
  }
}
