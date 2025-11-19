import { z } from "zod";
import { cpus } from "os";
import pRetry from "p-retry";
import { Worker } from "bullmq";
import type { Logger } from "pino";
import { Pipeline } from "@rhiva-ag/decoder";
import type { Connection } from "@solana/web3.js";
import type Coingecko from "@coingecko/coingecko-typescript";
import { mapFilter, type SendTransaction } from "@rhiva-ag/shared";
import { createSolanaRpc, type Rpc, type SolanaRpcApi } from "@solana/kit";
import {
  address,
  walletSchema,
  type walletSelectSchema,
  type Database,
} from "@rhiva-ag/datasource";
import {
  RaydiumProgramEventProcessor,
  RaydiumProgramInstructionEventProcessor,
} from "@rhiva-ag/decoder/programs/raydium/index";
import {
  WhirlpoolProgramEventProcessor,
  WhirlpoolProgramInstructionEventProcessor,
} from "@rhiva-ag/decoder/programs/orca/index";
import {
  MeteoraProgramEventProcessor,
  MeteoraProgramInstructionEventProcessor,
} from "@rhiva-ag/decoder/programs/meteora/index";

import { Work } from "../constants";
import { createRedis } from "../instances";
import { syncOrcaPositionStateFromEvent } from "../controllers/orca";
import { syncRaydiumPositionStateFromEvent } from "../controllers/raydium";
import { syncMeteoraPositionStateFromEvent } from "../controllers/meteora";

export const transactionWorkSchema = z
  .union([
    z
      .union([
        z.object({
          dex: z.enum(["orca", "meteora"]),
        }),
        z.object({
          dex: z.enum(["orca"]),
          positionMint: address().optional(),
        }),
        z.object({
          positionMint: address().optional(),
          dex: z.enum(["raydium-clmm"]),
        }),
      ])
      .and(
        z.object({
          type: z.literal("create-position"),
        }),
      ),
    z.object({
      type: z.enum(["closed-position", "rebalanced-position", "repositioned"]),
      dex: z.enum(["orca", "meteora", "raydium-clmm"]),
    }),
  ])
  .and(
    z.object({
      bundleId: z.string(),
      wallet: walletSchema.pick({ id: true, user: true }),
    }),
  );

export const createTransactionPipeline = ({
  db,
  rpc,
  type,
  wallet,
  coingecko,
  connection,
  positionMint,
}: {
  db: Database;
  coingecko: Coingecko;
  rpc: Rpc<SolanaRpcApi>;
  connection: Connection;
  positionMint?: string;
  type?: z.infer<typeof transactionWorkSchema>["type"];
  wallet: Pick<z.infer<typeof walletSelectSchema>, "id" | "user">;
}) =>
  new Pipeline([
    new MeteoraProgramEventProcessor(connection).addConsumer((events, extra) =>
      syncMeteoraPositionStateFromEvent({
        db,
        type,
        extra,
        events,
        wallet,
        coingecko,
        connection,
      }),
    ),
    new RaydiumProgramEventProcessor(connection).addConsumer((events, extra) =>
      syncRaydiumPositionStateFromEvent({
        db,
        type,
        extra,
        events,
        wallet,
        coingecko,
        connection,
        positionMint,
      }),
    ),
    new WhirlpoolProgramEventProcessor(connection).addConsumer(
      (events, extra) =>
        syncOrcaPositionStateFromEvent({
          db,
          rpc,
          type,
          wallet,
          events,
          extra,
          coingecko,
          positionMint,
        }),
    ),
    new MeteoraProgramInstructionEventProcessor(connection).addConsumer(
      (instructions, extra) =>
        syncMeteoraPositionStateFromEvent({
          db,
          type,
          extra,
          wallet,
          coingecko,
          connection,
          events: instructions.map((instruction) => instruction.parsed),
        }),
    ),
    new RaydiumProgramInstructionEventProcessor(connection).addConsumer(
      (instructions, extra) =>
        syncRaydiumPositionStateFromEvent({
          db,
          type,
          extra,
          wallet,
          coingecko,
          connection,
          positionMint,
          events: instructions.map((instruction) => instruction.parsed),
        }),
    ),
    new WhirlpoolProgramInstructionEventProcessor(connection).addConsumer(
      (instructions, extra) =>
        syncOrcaPositionStateFromEvent({
          db,
          rpc,
          type,
          extra,
          wallet,
          coingecko,
          positionMint,
          events: instructions.map((instruction) => instruction.parsed),
        }),
    ),
  ]);

export default async function createWorker({
  db,
  logger,
  sender,
  coingecko,
  connection,
}: {
  db: Database;
  logger: Logger;
  coingecko: Coingecko;
  connection: Connection;
  sender: SendTransaction;
}) {
  const rpc = createSolanaRpc(connection.rpcEndpoint);
  const worker = new Worker<z.infer<typeof transactionWorkSchema>>(
    Work.syncTransaction,
    async ({ data }) => {
      const result = transactionWorkSchema.safeParse(data);

      if (result.success) {
        const pipeline = createTransactionPipeline({
          db,
          rpc,
          connection,
          coingecko,
          type: data.type,
          wallet: data.wallet,
          positionMint: "positionMint" in data ? data.positionMint : undefined,
        });

        const bundle = await pRetry(() =>
          sender.safeGetBundle(data.bundleId, 30),
        );
        const response = mapFilter(
          await connection.getParsedTransactions(bundle.transactions, {
            maxSupportedTransactionVersion: 0,
          }),
          (transaction) => transaction,
        );

        return pipeline.process(...response);
      }

      logger.error(
        { data, error: result.error.format() },
        "worker.position.sync.error",
      );
    },
    {
      concurrency: cpus().length,
      connection: createRedis({ maxRetriesPerRequest: null }),
    },
  );

  worker.on("completed", (job) => {
    logger.info(
      { id: job.id, data: job.data },
      "worker.transaction.successful",
    );
  });
  worker.on("failed", (job, error) => {
    logger.error(
      {
        error,
        job: {
          id: job?.id,
          data: job?.data,
          stacktrace: job?.stacktrace,
          failedReason: job?.failedReason,
        },
      },
      "worker.transaction.failed",
    );
  });
  worker.on("error", (error) => {
    logger.error({ error }, "worker.transaction.sync.error");
  });

  if (!worker.isRunning()) await worker.run();

  return async () => {
    await worker.close();
    await worker.disconnect();
  };
}
