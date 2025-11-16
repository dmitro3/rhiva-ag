import { mapFilter } from "@rhiva-ag/shared";
import { useQueries } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, type AccountInfo } from "@solana/web3.js";
import { init as createOrcaProgram } from "@rhiva-ag/decoder/programs/orca/index";
import { init as createSarosProgram } from "@rhiva-ag/decoder/programs/saros/index";
import { init as createRaydiumProgram } from "@rhiva-ag/decoder/programs/raydium/index";
import { init as createMeteoraProgram } from "@rhiva-ag/decoder/programs/meteora/index";

type Dex = "meteora" | "orca" | "raydium-clmm" | "saros-dlmm";
const dexes: Dex[] = ["meteora", "orca", "raydium-clmm", "saros-dlmm"];

type Pool = {
  dex: Dex;
  pair: PublicKey;
};

const watchPoolAccounts = (pools: Pool[]) => {
  const { connection } = useConnection();
  const filterDexPools = (dex: Dex) => pools.filter((pool) => pool.dex === dex);
  const decodeOrcaAccountInfo = async (addresses: PublicKey[]) => {
    const [program] = createOrcaProgram(connection);
    return program.account.whirlpool.fetchMultiple(addresses);
  };

  const decodeMeteoraAccountInfo = (addresses: PublicKey[]) => {
    const [program] = createMeteoraProgram(connection);
    return program.account.lbPair.fetchMultiple(addresses);
  };
  const decodeSarosAccountInfo = (addresses: PublicKey[]) => {
    const [program] = createSarosProgram(connection);
    return program.account.pair.fetchMultiple(addresses);
  };
  const decodeRaydiumAccountInfo = (addresses: PublicKey[]) => {
    const [program] = createRaydiumProgram(connection);
    return program.account.poolState.fetchMultiple(addresses);
  };

  const decodeFnMaps: Record<Dex, Function> = {
    meteora: decodeMeteoraAccountInfo,
    "saros-dlmm": decodeSarosAccountInfo,
    orca: decodeOrcaAccountInfo,
    "raydium-clmm": decodeRaydiumAccountInfo,
  };

  const results = useQueries({
    queries: dexes.map((dex) => ({
      queryKey: [dex],
      queryFn: async () => {
        const fn = decodeFnMaps[dex];
        const pools = filterDexPools(dex);
        const accountInfos = await connection.getMultipleAccountsInfo(
          pools.map((pool) => pool.pair),
        );
        return mapFilter(accountInfos, (accountInfo, index) => {
          const pool = pools[index];
          return {
            ...pool,
            ...fn(accountInfo),
          };
        });
      },
    })),
  });
  connection.onProgramAccountChange(
    new PublicKey(""),
    ({ accountId, accountInfo }, x) => {},
  );
};
