import { format } from "util";
import { MintLayout } from "@solana/spl-token";
import { PoolInfoLayout } from "@raydium-io/raydium-sdk-v2";
import { PublicKey, type Connection } from "@solana/web3.js";
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

export async function upsertPool(
  db: Database,
  connection: Connection,
  poolId: string,
) {
  const pool = await getPoolById(db, poolId);

  if (pool) return pool;
  const accountInfo = await connection.getAccountInfo(new PublicKey(poolId));
  if (accountInfo) {
    const pair = PoolInfoLayout.decode(accountInfo.data);
    const rewardPubkeys = mapFilter(pair.rewardInfos, (reward) =>
      PublicKey.default.equals(reward.tokenMint) ? null : reward.tokenMint,
    );
    const mintPubkeys = [pair.mintA, pair.mintB, ...rewardPubkeys];

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
      dex: "raydium-clmm",
      config: {},
      baseToken: pair.mintA.toBase58(),
      quoteToken: pair.mintB.toString(),
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

  throw new Error(format("pool with id=%s not found.", poolId));
}
