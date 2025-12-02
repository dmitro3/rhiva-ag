import { mapFilter } from "@rhiva-ag/shared";
import { sender, solanaConnection, db, coingecko } from "../src/instances";
import { createInstructionPipeline } from "../src/workers/transaction.worker";

(async () => {
  const bundleId =
    "e4d2a9062b68576721bd4002713e76b944ad1178f7aff1be251d47fab820e4fb";
  const { transactions: signatures } = await sender.safeGetBundle(bundleId, 1);
  const transactions = mapFilter(
    await solanaConnection.getParsedTransactions(signatures, {
      maxSupportedTransactionVersion: 1,
    }),
    (tx) => tx,
  );
  const pipeline = createInstructionPipeline({
    db,
    coingecko,
    connection: solanaConnection,
    positionMint: "9hubSjn1DNZSojy1GEMZSYyTFyp5ABr85CHV8LBnfynN",
  });

  await pipeline.process(...transactions);
})();
