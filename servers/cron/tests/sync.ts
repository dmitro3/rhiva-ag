import { solanaConnection, db, coingecko } from "../src/instances";
import { syncRaydiumPositionsForWallet } from "../src/controllers/raydium";

(async () => {
  console.log(
    await syncRaydiumPositionsForWallet({
      db,
      coingecko,
      wallet: {
        id: "GQFJibdqFGdNXm5PKvm4MmEDgNXHP1JcXNonedi2Z7kT",
      },
      connection: solanaConnection,
    }),
  );
})();
