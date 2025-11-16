import BN from "bn.js";
import Decimal from "decimal.js";
import { MintLayout, type RawMint } from "@solana/spl-token";
import type { Address, Program } from "@coral-xyz/anchor";
import { PublicKey, type Connection } from "@solana/web3.js";
import { init } from "@rhiva-ag/decoder/programs/meteora/index";
import type { Bin, BinLiquidity, LbPair } from "@meteora-ag/dlmm";
import { mapFilter, promiseMapFilter } from "@rhiva-ag/shared";
import type { LbClmm } from "@rhiva-ag/decoder/programs/idls/types/meteora";
import DLMM, {
  range,
  getTotalFee,
  enumerateBins,
  deriveBinArray,
  getPriceOfBinByBinId,
  binIdToBinArrayIndex,
  getBinArrayLowerUpperBinId,
} from "@meteora-ag/dlmm";

type ScoreArgs = {
  addresses: Address[];
  positionSize: number;
};

type PoolData = {
  drift: number;
  lbPair: LbPair;
  bins: BinLiquidity[];
  positionSize: number;
  tokenXMint: RawMint;
  tokenYMint: RawMint;
};

export class MeteoraScoreStrategy {
  private readonly program: Program<LbClmm>;
  constructor(readonly connection: Connection) {
    [this.program] = init(connection);
  }

  static getPricePerLamport(
    tokenXDecimal: number,
    tokenYDecimal: number,
    price: Decimal,
  ) {
    return new Decimal(
      DLMM.getPricePerLamport(tokenXDecimal, tokenYDecimal, price.toNumber()),
    );
  }

  // get estimated fees for all bin liquidity
  static computePotentialFeesFromAmounts({
    bins,
    lbPair,
    positionSize,
    tokenXMint,
    tokenYMint,
  }: PoolData) {
    const midpoint = Math.floor(positionSize / 2);
    const lowerBinId = lbPair.activeId - midpoint;
    const upperBinId = lbPair.activeId + midpoint;
    const activeBins = bins.filter(
      (bin) => bin.binId >= lowerBinId && bin.binId <= upperBinId,
    );
    let feeX = new Decimal(0);
    let feeY = new Decimal(0);
    const currentPrice = MeteoraScoreStrategy.getPricePerLamport(
      tokenXMint.decimals,
      tokenYMint.decimals,
      getPriceOfBinByBinId(lbPair.activeId, lbPair.binStep),
    );
    const fees = getTotalFee(
      lbPair.binStep,
      lbPair.parameters,
      lbPair.vParameters,
    );

    for (const bin of activeBins) {
      feeX = feeX
        .add(
          new Decimal(bin.xAmount.mul(fees).toString()).div(
            Math.pow(10, tokenXMint.decimals),
          ),
        )
        .mul(currentPrice);
      feeY = feeY.add(
        new Decimal(bin.yAmount.mul(fees).toString()).div(
          Math.pow(10, tokenYMint.decimals),
        ),
      );
    }

    return feeX.add(feeY).toNumber();
  }

  static computeLiquidityShareFromAmounts(
    { bins, lbPair, positionSize }: PoolData,
    xAmount: BN,
    yAmount: BN,
  ) {
    const midpoint = Math.floor(positionSize / 2);
    const lowerBinId = lbPair.activeId - midpoint;
    const upperBinId = lbPair.activeId + midpoint;
    const activeBins = bins.filter(
      (bin) => bin.binId >= lowerBinId && bin.binId <= upperBinId,
    );

    const totalXAmount = activeBins.reduce(
      (acc, cur) => acc.add(cur.xAmount),
      xAmount,
    );
    const totalYAmount = activeBins.reduce(
      (acc, cur) => acc.add(cur.yAmount),
      yAmount,
    );

    return {
      xShare: new Decimal(xAmount.toString())
        .div(totalXAmount.toString())
        .toNumber(),
      yShare: new Decimal(yAmount.toString())
        .div(totalYAmount.toString())
        .toNumber(),
    };
  }

  static computeImpermanentLossRiskFromAmounts(
    { lbPair, bins, positionSize, tokenXMint, tokenYMint }: PoolData,
    xAmount: BN,
    yAmount: BN,
  ) {
    const midpoint = Math.floor(positionSize / 2);

    const getActiveBins = (
      activeId: number,
      deltaLeft: number,
      deltaRight: number,
    ) => {
      const lowerBinId = activeId - deltaLeft;
      const upperBinId = activeId + deltaRight;

      return bins.filter(
        (bin) => bin.binId >= lowerBinId && bin.binId <= upperBinId,
      );
    };

    const getBinRelativeValue = (activeId: number) => {
      let xAmountValue = new Decimal(0);
      let yAmountValue = new Decimal(0);
      const activeBins = getActiveBins(activeId, midpoint, midpoint);

      if (activeBins.length > 0) {
        const currentPrice = MeteoraScoreStrategy.getPricePerLamport(
          tokenXMint.decimals,
          tokenYMint.decimals,
          getPriceOfBinByBinId(activeId, lbPair.binStep),
        );
        const totalXAmount = activeBins.reduce(
          (acc, cur) => acc.add(cur.xAmount),
          xAmount,
        );
        const totalYAmount = activeBins.reduce(
          (acc, cur) => acc.add(cur.yAmount),
          yAmount,
        );
        const xShare = new Decimal(xAmount.toString()).div(
          totalXAmount.isZero() ? 1 : totalXAmount.toString(),
        );
        const yShare = new Decimal(yAmount.toString()).div(
          totalYAmount.isZero() ? 1 : totalYAmount.toString(),
        );

        for (const bin of activeBins) {
          xAmountValue = xAmountValue.add(
            xShare
              .mul(bin.xAmount.toString())
              .div(Math.pow(10, tokenXMint.decimals))
              .mul(currentPrice),
          );
          yAmountValue = yAmountValue
            .add(yShare.mul(bin.yAmount.toString()))
            .div(Math.pow(10, tokenYMint.decimals));
        }
      }

      return {
        xAmountValue,
        yAmountValue,
      };
    };

    const { xAmountValue: currentX, yAmountValue: currentY } =
      getBinRelativeValue(lbPair.activeId);
    const deltaLiquidities: Decimal[] = [];

    for (let index = 0; index < midpoint; index++) {
      const forward = getBinRelativeValue(lbPair.activeId + index);

      const backward = getBinRelativeValue(lbPair.activeId - index);

      deltaLiquidities.push(forward.xAmountValue.add(forward.yAmountValue));
      deltaLiquidities.push(backward.xAmountValue.add(backward.yAmountValue));
    }

    const futureLiquidity = deltaLiquidities
      .reduce((acc, cur) => acc.add(cur), new Decimal(0))
      .div(deltaLiquidities.length);
    const currentPrice = MeteoraScoreStrategy.getPricePerLamport(
      tokenXMint.decimals,
      tokenYMint.decimals,
      getPriceOfBinByBinId(lbPair.activeId, lbPair.binStep),
    );
    const currentLiquidity = currentX
      .div(Math.pow(10, tokenXMint.decimals))
      .mul(currentPrice)
      .add(currentY)
      .div(Math.pow(10, tokenYMint.decimals));

    return currentLiquidity.div(futureLiquidity);
  }

  async getOnchainPoolData({
    addresses,
    positionSize,
  }: ScoreArgs): Promise<PoolData[]> {
    const midpoint = Math.floor(positionSize / 2);
    const drift = Math.floor(midpoint / 2);
    const lbPairs = await this.program.account.lbPair.fetchMultiple(addresses);
    const tokenMints = new Map<string, PublicKey>();
    for (const lbPair of lbPairs) {
      if (lbPair) {
        const mints = [lbPair.tokenXMint, lbPair.tokenYMint];
        for (const mint of mints) {
          const exists = tokenMints.has(mint.toBase58());
          if (exists) continue;
          tokenMints.set(mint.toBase58(), mint);
        }
      }
    }

    const mints = Array.from(tokenMints.values());
    const mintInfos = new Map(
      mapFilter(
        await this.connection.getMultipleAccountsInfo(mints),
        (accountInfo, index) => {
          const mint = mints[index];
          if (mint && accountInfo)
            return [
              mint.toBase58(),
              {
                pubkey: mint,
                owner: accountInfo.owner,
                ...MintLayout.decode(accountInfo.data),
              },
            ] as const;
        },
      ),
    );

    return promiseMapFilter(lbPairs, async (lbPair, index) => {
      const pubkey = addresses[index];

      if (lbPair && pubkey) {
        const tokenXMint = mintInfos.get(lbPair.tokenXMint.toBase58());
        const tokenYMint = mintInfos.get(lbPair.tokenYMint.toBase58());

        if (tokenXMint && tokenYMint) {
          const activeId = lbPair.activeId;
          const lowerBinId = activeId - (midpoint + drift);
          const upperBinId = activeId + (midpoint + drift);

          const lowerBinArrayIndex = binIdToBinArrayIndex(new BN(lowerBinId));
          const upperBinArrayIndex = binIdToBinArrayIndex(new BN(upperBinId));

          const binArrayPubkeys = range(
            lowerBinArrayIndex.toNumber(),
            upperBinArrayIndex.toNumber(),
            (index) => {
              const [pda] = deriveBinArray(
                new PublicKey(pubkey),
                new BN(index),
                this.program.programId,
              );
              return pda;
            },
          );

          const binArrays =
            await this.program.account.binArray.fetchMultiple(binArrayPubkeys);
          const binsById = new Map(
            mapFilter(binArrays, (binArray) => {
              if (binArray) {
                const [lowerBinId] = getBinArrayLowerUpperBinId(
                  binArray.index,
                ) as [BN];
                return binArray.bins.map(
                  (bin, index) =>
                    [lowerBinId?.toNumber() + index, bin] as [number, Bin],
                );
              }
            }).flat(),
          );

          const version =
            binArrays.find((binArray) => binArray != null)?.version ?? 1;

          const bins = Array.from(
            enumerateBins(
              binsById,
              lowerBinId,
              upperBinId,
              lbPair.binStep,
              tokenXMint.decimals,
              tokenYMint.decimals,
              version,
            ),
          );

          return {
            drift,
            bins,
            lbPair,
            tokenXMint,
            tokenYMint,
            positionSize,
          };
        }
      }
    });
  }
}
