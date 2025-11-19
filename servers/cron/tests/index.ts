import { createSolanaRpc } from "@solana/kit";
import { syncOrcaPositionsForWallet } from "../src/controllers/orca/sync";
import { coingecko, db, solanaConnection } from "../src/instances";
const rpc = createSolanaRpc(solanaConnection.rpcEndpoint);
console.log(
  await syncOrcaPositionsForWallet({
    db,
    rpc,
    coingecko,
    wallet: {
      id: "GQFJibdqFGdNXm5PKvm4MmEDgNXHP1JcXNonedi2Z7kT",
    },
  }),
);
