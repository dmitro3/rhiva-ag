import type BN from "bn.js";
import type { PublicKey } from "@solana/web3.js";
import type { LbPosition, StrategyType } from "@meteora-ag/dlmm";
import type {
  LiquidityBookServices,
  // getIdFromPrice,
} from "@saros-finance/dlmm-sdk";

export class SarosDLMM {
  constructor(readonly services: LiquidityBookServices) {}

  readonly buildCreatePosition = async (_args: {
    pair: PublicKey;
    totalXAmount: BN;
    totalYAmount: BN;
    position: PublicKey;
    owner: PublicKey;
    slippage: number;
    priceChanges: [number, number];
    strategyType: StrategyType;
  }) => {
    // const pool = await this.services.getPairAccount(pair);
    // this.services.createPosition({
    //   payer: new PublicKey(),
    //   relativeBinIdLeft: 0,
    //   relativeBinIdRight: 0,
    //   pair: new PublicKey(),
    //   binArrayIndex: 0,
    //   positionMint: new PublicKey(),
    //   transaction: new Transaction(),
    // });
  };

  readonly buildClaimReward = async (_args: {
    pool: PublicKey;
    owner: PublicKey;
    position: LbPosition;
  }) => {};

  readonly buildClosePosition = async (_args: {
    pool: PublicKey;
    owner: PublicKey;
    position: LbPosition;
  }) => {};
}
