// import type BN from "bn.js";
// import Decimal from "decimal.js";
// import type { Address, Program } from "@coral-xyz/anchor";
// import type { PublicKey, Connection } from "@solana/web3.js";
// import { MintLayout, type RawMint } from "@solana/spl-token";
// import { init } from "@rhiva-ag/decoder/programs/orca/index";
// import { mapFilter, promiseMapFilter } from "@rhiva-ag/shared";
// import type { Whirlpool as WhirlpoolIdl } from "@rhiva-ag/decoder/programs/idls/types/orca";
// import {
//   tickIndexToPrice,
//   getTickIndexInArray,
//   getTickArrayStartTickIndex,
// } from "@orca-so/whirlpools-sdk/whirlpools-core";
// import {
//   getTickArrayAddress,
//   type Whirlpool,
// } from "@orca-so/whirlpools-sdk/whirlpools-client";
// import { type TickData, TickArrayUtil } from "@orca-so/whirlpools-sdk";
// import { range } from "@meteora-ag/dlmm";
// import { address } from "@solana/kit";

// type ScoreArgs = {
//   addresses: Address[];
//   positionSize: number;
// };

// type PoolData = {
//   drift: number;
//   whirlpool: Whirlpool;
//   positionSize: number;
//   tokenXMint: RawMint;
//   tokenYMint: RawMint;
//   ticks: ({ index: number } & TickData)[];
// };

// export class OrcaScoreStrategy {
//   private readonly program: Program<WhirlpoolIdl>;
//   constructor(readonly connection: Connection) {
//     [this.program] = init(connection);
//   }

//   // get estimated fees for all bin liquidity
//   static computePotentialFeesFromAmounts({
//     ticks,
//     whirlpool,
//     positionSize,
//     tokenXMint,
//     tokenYMint,
//   }: PoolData) {
//     const midpoint = Math.floor(positionSize / 2);
//     const lowerBinId = whirlpool.tickCurrentIndex - midpoint;
//     const upperBinId = whirlpool.tickCurrentIndex + midpoint;
//     const activeBins = ticks.filter(
//       (bin) => bin.index >= lowerBinId && bin.index <= upperBinId,
//     );
//     let feeX = new Decimal(0);
//     let feeY = new Decimal(0);
//     const currentPrice = tickIndexToPrice(
//       whirlpool.tickCurrentIndex,
//       tokenXMint.decimals,
//       tokenYMint.decimals,
//     );
//     const fees = getTotalFee(
//       lbPair.binStep,
//       lbPair.parameters,
//       lbPair.vParameters,
//     );

//     for (const bin of activeBins) {
//       feeX = feeX
//         .add(
//           new Decimal(bin.xAmount.mul(fees).toString()).div(
//             Math.pow(10, tokenXMint.decimals),
//           ),
//         )
//         .mul(currentPrice);
//       feeY = feeY.add(
//         new Decimal(bin.yAmount.mul(fees).toString()).div(
//           Math.pow(10, tokenYMint.decimals),
//         ),
//       );
//     }

//     return feeX.add(feeY).toNumber();
//   }

//   static computeLiquidityShareFromAmounts(
//     { ticks, whirlpool, positionSize }: PoolData,
//     xAmount: BN,
//     yAmount: BN,
//   ) {
//     const midpoint = Math.floor(positionSize / 2);
//     const lowerBinId = whirlpool.tickCurrentIndex - midpoint;
//     const upperBinId = whirlpool.tickCurrentIndex + midpoint;
//     const activeBins = ticks.filter(
//       (bin) => bin.index >= lowerBinId && bin.index <= upperBinId,
//     );

//     const totalXAmount = activeBins.reduce(
//       (acc, cur) => acc.add(cur.xAmount),
//       xAmount,
//     );
//     const totalYAmount = activeBins.reduce(
//       (acc, cur) => acc.add(cur.yAmount),
//       yAmount,
//     );

//     return {
//       xShare: new Decimal(xAmount.toString())
//         .div(totalXAmount.toString())
//         .toNumber(),
//       yShare: new Decimal(yAmount.toString())
//         .div(totalYAmount.toString())
//         .toNumber(),
//     };
//   }

//   static computeImpermanentLossRiskFromAmounts(
//     { whirlpool, ticks, positionSize, tokenXMint, tokenYMint }: PoolData,
//     xAmount: BN,
//     yAmount: BN,
//   ) {
//     const midpoint = Math.floor(positionSize / 2);

//     const getActiveBins = (
//       activeId: number,
//       deltaLeft: number,
//       deltaRight: number,
//     ) => {
//       const lowerTickId = activeId - deltaLeft;
//       const upperTickId = activeId + deltaRight;

//       return ticks.filter(
//         (bin) => bin.index >= lowerTickId && bin.index <= upperTickId,
//       );
//     };

//     const getBinRelativeValue = (activeTickIndex: number) => {
//       let xAmountValue = new Decimal(0);
//       let yAmountValue = new Decimal(0);
//       const activeBins = getActiveBins(activeTickIndex, midpoint, midpoint);

//       if (activeBins.length > 0) {
//         const currentPrice = tickIndexToPrice(
//           activeTickIndex,
//           tokenXMint.decimals,
//           tokenYMint.decimals,
//         );
//         const totalXAmount = activeBins.reduce(
//           (acc, cur) => acc.add(cur.xAmount),
//           xAmount,
//         );
//         const totalYAmount = activeBins.reduce(
//           (acc, cur) => acc.add(cur.yAmount),
//           yAmount,
//         );
//         const xShare = new Decimal(xAmount.toString()).div(
//           totalXAmount.isZero() ? 1 : totalXAmount.toString(),
//         );
//         const yShare = new Decimal(yAmount.toString()).div(
//           totalYAmount.isZero() ? 1 : totalYAmount.toString(),
//         );

//         for (const bin of activeBins) {
//           xAmountValue = xAmountValue.add(
//             xShare
//               .mul(bin.xAmount.toString())
//               .div(Math.pow(10, tokenXMint.decimals))
//               .mul(currentPrice),
//           );
//           yAmountValue = yAmountValue
//             .add(yShare.mul(bin.yAmount.toString()))
//             .div(Math.pow(10, tokenYMint.decimals));
//         }
//       }

//       return {
//         xAmountValue,
//         yAmountValue,
//       };
//     };

//     const { xAmountValue: currentX, yAmountValue: currentY } =
//       getBinRelativeValue(whirlpool.tickCurrentIndex);
//     const deltaLiquidities: Decimal[] = [];

//     for (let index = 0; index < midpoint; index++) {
//       const forward = getBinRelativeValue(whirlpool.tickCurrentIndex + index);

//       const backward = getBinRelativeValue(whirlpool.tickCurrentIndex - index);

//       deltaLiquidities.push(forward.xAmountValue.add(forward.yAmountValue));
//       deltaLiquidities.push(backward.xAmountValue.add(backward.yAmountValue));
//     }

//     const futureLiquidity = deltaLiquidities
//       .reduce((acc, cur) => acc.add(cur), new Decimal(0))
//       .div(deltaLiquidities.length);
//     const currentPrice = tickIndexToPrice(
//       whirlpool.tickCurrentIndex,
//       tokenXMint.decimals,
//       tokenYMint.decimals,
//     );
//     const currentLiquidity = currentX
//       .div(Math.pow(10, tokenXMint.decimals))
//       .mul(currentPrice)
//       .add(currentY)
//       .div(Math.pow(10, tokenYMint.decimals));

//     return currentLiquidity.div(futureLiquidity);
//   }

//   async getOnchainPoolData({
//     addresses,
//     positionSize,
//   }: ScoreArgs): Promise<PoolData[]> {
//     const midpoint = Math.floor(positionSize / 2);
//     const drift = Math.floor(midpoint / 2);
//     const whirlpools =
//       await this.program.account.whirlpool.fetchMultiple(addresses);
//     const tokenMints = new Map<string, PublicKey>();
//     for (const whirlpool of whirlpools) {
//       if (whirlpool) {
//         const mints = [whirlpool.tokenMintA, whirlpool.tokenMintB];
//         for (const mint of mints) {
//           const exists = tokenMints.has(mint.toBase58());
//           if (exists) continue;
//           tokenMints.set(mint.toBase58(), mint);
//         }
//       }
//     }

//     const mints = Array.from(tokenMints.values());
//     const mintInfos = new Map(
//       mapFilter(
//         await this.connection.getMultipleAccountsInfo(mints),
//         (accountInfo, index) => {
//           const mint = mints[index];
//           if (mint && accountInfo)
//             return [
//               mint.toBase58(),
//               {
//                 pubkey: mint,
//                 owner: accountInfo.owner,
//                 ...MintLayout.decode(accountInfo.data),
//               },
//             ] as const;
//         },
//       ),
//     );

//     return promiseMapFilter(whirlpools, async (whirlpool, index) => {
//       const pubkey = addresses[index];

//       if (whirlpool && pubkey) {
//         const tokenXMint = mintInfos.get(whirlpool.tokenMintA.toBase58());
//         const tokenYMint = mintInfos.get(whirlpool.tokenMintB.toBase58());

//         if (tokenXMint && tokenYMint) {
//           const activeId = whirlpool.tickCurrentIndex;
//           const lowerBinId = activeId - (midpoint + drift);
//           const upperBinId = activeId + (midpoint + drift);

//           const lowerTickArrayIndex = getTickArrayStartTickIndex(
//             lowerBinId,
//             whirlpool.tickSpacing,
//           );
//           const upperTickArrayIndex = getTickArrayStartTickIndex(
//             upperBinId,
//             whirlpool.tickSpacing,
//           );

//           const tickArrayPubkeys = await Promise.all(
//             range(lowerTickArrayIndex, upperTickArrayIndex, async (index) => {
//               const [pda] = await getTickArrayAddress(
//                 address(pubkey.toString()),
//                 index,
//               );
//               return pda;
//             }),
//           );

//           const tickArrays =
//             await this.program.account.tickArray.fetchMultiple(
//               tickArrayPubkeys,
//             );
//           const ticks = mapFilter(tickArrays, (tickArray) => {
//             if (tickArray) {
//               return tickArray.ticks.map((tick, index) => ({
//                 ...tick,
//                 index: tickArray.startTickIndex + index,
//               }));
//             }
//           }).flat();

//           return {
//             drift,
//             ticks,
//             whirlpool,
//             tokenXMint,
//             tokenYMint,
//             positionSize,
//           };
//         }
//       }
//     });
//   }
// }
