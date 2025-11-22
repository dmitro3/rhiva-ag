import { format } from "util";
import Decimal from "decimal.js";
import { MintLayout } from "@solana/spl-token";
import { createProgram } from "@meteora-ag/dlmm";
import { type Connection, PublicKey } from "@solana/web3.js";
import {
  type Database,
  mints,
  pools,
  poolRewardTokens,
} from "@rhiva-ag/datasource";
import {
  mapFilter,
  chunkFetchMultipleAccounts,
  isNative,
  isTokenProgram,
} from "@rhiva-ag/shared";

import { getPoolById } from "../shared";

export function fromPricePerLamport(
  pricePerLamport: Decimal,
  decimal0: number,
  decimal1: number,
) {
  return new Decimal(pricePerLamport).div(
    new Decimal(10 ** (decimal1 - decimal0)),
  );
}

export async function upsertPool(
  db: Database,
  connection: Connection,
  poolId: string,
) {
  const pool = await getPoolById(db, poolId);

  if (pool) return pool;
  const program = createProgram(connection);
  const pair = await program.account.lbPair.fetch(poolId);

  if (pair) {
    const rewardPubkeys = mapFilter(pair.rewardInfos, (reward) =>
      PublicKey.default.equals(reward.mint) ? null : reward.mint,
    );
    const mintPubkeys = [pair.tokenXMint, pair.tokenYMint, ...rewardPubkeys];

    const mintAccountInfos = await chunkFetchMultipleAccounts(
      mintPubkeys,
      connection.getMultipleAccountsInfo.bind(connection),
    );
    const mintValues = mapFilter(mintAccountInfos, (mintAccountInfo) => {
      if (mintAccountInfo) {
        if (isNative(mintAccountInfo.owner))
          return {
            decimals: 9,
            id: mintAccountInfo.publicKey.toBase58(),
            tokenProgram: mintAccountInfo.owner.toBase58(),
          };
        else if (isTokenProgram(mintAccountInfo.owner)) {
          const account = MintLayout.decode(mintAccountInfo.data);
          return {
            decimals: account.decimals,
            id: mintAccountInfo.publicKey.toBase58(),
            tokenProgram: mintAccountInfo.owner.toBase58(),
          };
        }
      }
    });

    if (mintValues.length > 0)
      await db.insert(mints).values(mintValues).onConflictDoNothing().execute();

    await db.insert(pools).values({
      id: poolId,
      dex: "meteora",
      config: {},
      baseToken: pair.tokenXMint.toBase58(),
      quoteToken: pair.tokenYMint.toBase58(),
      rewardTokens: rewardPubkeys.map((pubkey) => pubkey.toBase58()),
    });

    if (rewardPubkeys.length > 0)
      await db.insert(poolRewardTokens).values(
        rewardPubkeys.map((pubkey) => ({
          pool: poolId,
          mint: pubkey.toBase58(),
        })),
      );

    return getPoolById(db, poolId);
  }

  throw new Error(format("pool with id=% not found", poolId));
}
