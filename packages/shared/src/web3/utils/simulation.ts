import type {
  Rpc,
  SimulateTransactionApi,
  Base64EncodedWireTransaction,
} from "@solana/kit";
import type {
  Connection,
  VersionedTransaction,
  SimulateTransactionConfig,
} from "@solana/web3.js";

export const batchRPCSimulateTransactions = (
  rpc: Rpc<SimulateTransactionApi>,
  {
    transactions,
    options,
  }: {
    transactions: Base64EncodedWireTransaction[];
    options: Exclude<
      Parameters<SimulateTransactionApi["simulateTransaction"]>[number],
      Base64EncodedWireTransaction
    >;
  },
) =>
  Promise.all(
    transactions.map((transaction) =>
      rpc
        .simulateTransaction(transaction, options)
        .send()
        .then(({ value }) => value),
    ),
  );

export const batchSimulateTransactions = (
  connection: Connection,
  {
    transactions,
    options,
  }: {
    transactions: VersionedTransaction[];
    options: SimulateTransactionConfig;
  },
) =>
  Promise.all(
    transactions.map((transaction) =>
      connection
        .simulateTransaction(transaction, options)
        .then(({ value }) => value),
    ),
  );
