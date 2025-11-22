import { PublicKey } from "@solana/web3.js";
import { fromLegacyPublicKey } from "@solana/compat";
import { getMintDecoder } from "@solana-program/token";
import { address, type Rpc, type SolanaRpcApi } from "@solana/kit";
import { fetchWhirlpool } from "@orca-so/whirlpools-sdk/whirlpools-client";
import {
  mints,
  poolRewardTokens,
  pools,
  type Database,
} from "@rhiva-ag/datasource";
import {
  chunkFetchMultipleAccounts,
  isNative,
  isTokenProgram,
  mapFilter,
} from "@rhiva-ag/shared";

import { getPoolById } from "../shared";

export async function upsertPool(
  db: Database,
  rpc: Rpc<SolanaRpcApi>,
  poolId: string,
) {
  const pool = await getPoolById(db, poolId);

  if (pool) return pool;
  const { data: pair } = await fetchWhirlpool(rpc, address(poolId));

  const rewardPubkeys = mapFilter(pair.rewardInfos, (reward) =>
    fromLegacyPublicKey(PublicKey.default) === reward.mint ? null : reward.mint,
  );
  const mintPubkeys = [pair.tokenMintA, pair.tokenMintB, ...rewardPubkeys];

  const mintAccountInfos = await chunkFetchMultipleAccounts(
    mintPubkeys,
    (keys) =>
      rpc
        .getMultipleAccounts(keys)
        .send()
        .then(({ value }) => value),
  );
  const mintValues = mapFilter(mintAccountInfos, (mintAccountInfo) => {
    if (mintAccountInfo) {
      if (isNative(mintAccountInfo.owner))
        return {
          decimals: 9,
          id: mintAccountInfo.publicKey,
          tokenProgram: mintAccountInfo.owner,
        };
      else if (isTokenProgram(mintAccountInfo.owner)) {
        const mintDecoder = getMintDecoder();
        const [data, encoding] = mintAccountInfo.data;
        const account = mintDecoder.decode(Buffer.from(data, encoding));
        return {
          decimals: account.decimals,
          id: mintAccountInfo.publicKey,
          tokenProgram: mintAccountInfo.owner,
        };
      }
    }
  });

  if (mintValues.length > 0)
    await db.insert(mints).values(mintValues).onConflictDoNothing().execute();

  await db.insert(pools).values({
    id: poolId,
    dex: "orca",
    config: {},
    baseToken: pair.tokenMintA,
    quoteToken: pair.tokenMintB,
    rewardTokens: rewardPubkeys,
  });

  if (rewardPubkeys.length > 0)
    await db.insert(poolRewardTokens).values(
      rewardPubkeys.map((pubkey) => ({
        pool: poolId,
        mint: pubkey,
      })),
    );

  return getPoolById(db, poolId);
}
