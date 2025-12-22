// todo: this worker can optimize the instruction and transaction step and eliminate preconfig of accounts in job data
import type { z } from "zod";
import pRetry from "p-retry";
import { Worker } from "bullmq";
import type { Logger } from "pino";
import { Pipeline } from "@rhiva-ag/decoder";
import type { Connection } from "@solana/web3.js";
import type Coingecko from "@coingecko/coingecko-typescript";
import { mapFilter, type SendTransaction } from "@rhiva-ag/shared";
import type { walletSelectSchema, Database } from "@rhiva-ag/datasource";
import { createSolanaRpc, type Rpc, type SolanaRpcApi } from "@solana/kit";
import {
  RaydiumProgramEventProcessor,
  RaydiumProgramInstructionProcessor,
  RaydiumProgramInstructionEventProcessor,
} from "@rhiva-ag/decoder/programs/raydium/index";
import {
  WhirlpoolProgramEventProcessor,
  WhirlpoolProgramInstructionProcessor,
  WhirlpoolProgramInstructionEventProcessor,
} from "@rhiva-ag/decoder/programs/orca/index";
import {
  MeteoraProgramEventProcessor,
  MeteoraProgramInstructionEventProcessor,
} from "@rhiva-ag/decoder/programs/meteora/index";

import { runWorker } from "../runner";
import { sendEvent } from "../utils";
import { transactionWorkSchema } from "../schemas";
import { CONCURRENT_WORK, Work } from "../constants";
import { syncOrcaPositionStateFromEvent } from "../controllers/orca";
import { syncRaydiumPositionStateFromEvent } from "../controllers/raydium";
import { syncMeteoraPositionStateFromEvent } from "../controllers/meteora";
import { syncOrcaPositionStateFromInstructions } from "../controllers/orca/instruction";
import { syncRaydiumPositionStateFromInstructions } from "../controllers/raydium/instruction";
import {
  db,
  logger,
  sender,
  coingecko,
  createRedis,
  solanaConnection,
} from "../instances";

const createTransactionPipeline = ({
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

export const createInstructionPipeline = ({
  db,
  coingecko,
  connection,
  positionMint,
}: {
  db: Database;
  coingecko: Coingecko;
  positionMint: string;
  connection: Connection;
}) =>
  new Pipeline([
    new RaydiumProgramInstructionProcessor(connection).addConsumer(
      async (instructions, extra) =>
        syncRaydiumPositionStateFromInstructions({
          db,
          extra,
          coingecko,
          connection,
          instructions,
          positionMint,
        }),
    ),

    new WhirlpoolProgramInstructionProcessor(connection).addConsumer(
      async (instructions, extra) =>
        syncOrcaPositionStateFromInstructions({
          db,
          extra,
          coingecko,
          connection,
          instructions,
          positionMint,
        }),
    ),
  ]);

const fn = async ({
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
}) => {
  const rpc = createSolanaRpc(connection.rpcEndpoint);
  const worker = new Worker<z.infer<typeof transactionWorkSchema>>(
    Work.syncTransaction,
    async ({ data, ...job }) => {
      const redis = await worker.client;
      const result = transactionWorkSchema.safeParse(data);

      if (result.success) {
        if (job.id)
          await sendEvent(redis, job.id, {
            jobId: job.id,
            type: data.type,
            status: "progress",
            message: "Processing transaction",
          });
        const transactionPipeline = createTransactionPipeline({
          db,
          rpc,
          connection,
          coingecko,
          type: data.type,
          wallet: data.wallet,
          positionMint: "positionMint" in data ? data.positionMint : undefined,
        });
        let instructionPipeline:
          | ReturnType<typeof createInstructionPipeline>
          | undefined;
        if ("positionMint" in data)
          instructionPipeline = createInstructionPipeline({
            db,
            coingecko,
            connection,
            positionMint: data.positionMint,
          });
        const bundle = await pRetry(() =>
          sender.safeGetBundle(data.bundleId, 30),
        );
        if (job.id)
          await sendEvent(redis, job.id, {
            jobId: job.id,
            type: data.type,
            status: "progress",
            message: "Transaction bundle parsed",
          });

        const response = mapFilter(
          await connection.getParsedTransactions(bundle.transactions, {
            maxSupportedTransactionVersion: 0,
          }),
          (transaction) => transaction,
        );

        const result = await Promise.all([
          transactionPipeline.process(...response),
          instructionPipeline?.process(...response),
        ]);

        return result.flat();
      }

      logger.error(
        { data, error: result.error.format() },
        "worker.position.sync.error",
      );
    },
    {
      concurrency: CONCURRENT_WORK,
      connection: createRedis({ maxRetriesPerRequest: null }),
    },
  );

  worker.on("active", async (job) => {
    const redis = await worker.client;
    await sendEvent(redis, job.id!, {
      jobId: job.id,
      status: "pending",
      type: job.data.type,
      message: "Processing bundle transactions",
    });
  });

  worker.on("completed", async (job) => {
    if (job.id) {
      const redis = await worker.client;
      await sendEvent(redis, job.id, {
        jobId: job.id,
        status: "completed",
        type: job.data.type,
        result: job.returnvalue,
        message: "Bundle transactions processed",
      });
    }

    logger.info(
      { id: job.id, data: job.data },
      "worker.transaction.successful",
    );
  });
  worker.on("failed", async (job, error) => {
    if (job?.id) {
      const redis = await worker.client;
      await sendEvent(redis, job!.id!, {
        jobId: job.id,
        status: "error",
        type: job.data.type,
        stacktrace: job.stacktrace,
        message: job.failedReason,
      });
    }

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
};

export default runWorker(
  fn({
    db,
    logger,
    sender,
    coingecko,
    connection: solanaConnection,
  }),
);
