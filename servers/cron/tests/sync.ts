import { solanaConnection, db, coingecko } from "../src/instances";
import { syncMeteoraPositionsForWallet } from "../src/controllers/meteora";

(async () => {
  console.log(
    await syncMeteoraPositionsForWallet({
      db,
      coingecko,
      wallet: {
        id: "DUhm8aTpGsaYzbo2JQ5hhrNf9KANxuQcqNXJSCQsWpfX",
      },
      connection: solanaConnection,
    }),
  );
})();
