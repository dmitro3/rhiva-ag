import { BN } from "bn.js";
import type { PublicKey, Connection } from "@solana/web3.js";
import {
  range,
  createProgram,
  binIdToBinArrayIndex,
  getBinArrayLowerUpperBinId,
  enumerateBins,
  deriveBinArray,
  type Bin,
  type BinArray,
  type ClmmProgram,
  type BinLiquidity,
} from "@meteora-ag/dlmm";

export const getActiveBin = async (
  connection: Connection,
  lbPairPubKey: PublicKey,
  baseTokenDecimal: number,
  quoteTokenDecimal: number,
): Promise<BinLiquidity> => {
  const program = createProgram(connection);
  const { activeId, binStep } =
    await program.account.lbPair.fetch(lbPairPubKey);
  const [activeBinState] = await getBins(program, {
    binStep,
    lbPairPubKey,
    upperBinId: activeId,
    lowerBinId: activeId,
    baseTokenDecimal,
    quoteTokenDecimal,
  });
  return activeBinState;
};

const getBins = async (
  program: ClmmProgram,
  {
    binStep,
    lowerBinId,
    upperBinId,
    lbPairPubKey,
    baseTokenDecimal,
    quoteTokenDecimal,
    lowerBinArray,
    upperBinArray,
  }: {
    binStep: number;
    lowerBinId: number;
    upperBinId: number;
    lbPairPubKey: PublicKey;
    baseTokenDecimal: number;
    quoteTokenDecimal: number;
    lowerBinArray?: BinArray;
    upperBinArray?: BinArray;
  },
) => {
  const lowerBinArrayIndex = binIdToBinArrayIndex(new BN(lowerBinId));
  const upperBinArrayIndex = binIdToBinArrayIndex(new BN(upperBinId));

  const hasCachedLowerBinArray = lowerBinArray != null;
  const hasCachedUpperBinArray = upperBinArray != null;
  const isSingleBinArray = lowerBinArrayIndex.eq(upperBinArrayIndex);

  const lowerBinArrayIndexOffset = hasCachedLowerBinArray ? 1 : 0;
  const upperBinArrayIndexOffset = hasCachedUpperBinArray ? -1 : 0;

  const binArrayPubkeys = range(
    lowerBinArrayIndex.toNumber() + lowerBinArrayIndexOffset,
    upperBinArrayIndex.toNumber() + upperBinArrayIndexOffset,
    (i) => deriveBinArray(lbPairPubKey, new BN(i), program.programId)[0],
  );
  const fetchedBinArrays =
    binArrayPubkeys.length !== 0
      ? await program.account.binArray.fetchMultiple(binArrayPubkeys)
      : [];
  const binArrays = [
    ...(hasCachedLowerBinArray ? [lowerBinArray] : []),
    ...fetchedBinArrays,
    ...(hasCachedUpperBinArray && !isSingleBinArray ? [upperBinArray] : []),
  ];

  const binsById = new Map(
    binArrays
      .filter((x) => x != null)
      .flatMap(({ bins, index }) => {
        const [lowerBinId] = getBinArrayLowerUpperBinId(index);
        return bins.map(
          (b, i) => [lowerBinId.toNumber() + i, b] as [number, Bin],
        );
      }),
  );
  const version = binArrays.find((binArray) => binArray != null)?.version ?? 1;

  return Array.from(
    enumerateBins(
      binsById,
      lowerBinId,
      upperBinId,
      binStep,
      baseTokenDecimal,
      quoteTokenDecimal,
      version,
    ),
  );
};
