import { Connection, PublicKey } from "@solana/web3.js";

(async () => {
  const connection = new Connection("http://0.0.0.0:8000");
  const address = new PublicKey("GQFJibdqFGdNXm5PKvm4MmEDgNXHP1JcXNonedi2Z7kT");
  const balance = await connection.getBalance(address);
  console.log(balance);
})();
