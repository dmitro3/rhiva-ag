import "dotenv/config";
import { format } from "util";
import cluster from "cluster";
import { Telegraf } from "telegraf";
import type { Update } from "@telegraf/types";
import fastify, { type FastifyInstance, type FastifyRequest } from "fastify";

import { getEnv } from "./env";

async function main(server: FastifyInstance, bot: Telegraf) {
  const promises = [];

  if (process.env.DOMAIN) {
    if (
      cluster.isPrimary &&
      process.env.MASTER &&
      process.env.NODE_APP_INSTANCE === "0"
    )
      await bot.telegram.setWebhook(
        format(
          "https://%s/telegraf/%s",
          process.env.DOMAIN,
          bot.secretPathComponent(),
        ),
      );

    server.post(
      format("/telegraf/%", bot.secretPathComponent()),
      async (request: FastifyRequest<{ Body: Update }>, reply) =>
        bot.handleUpdate(request.body, reply.raw),
    );
  } else promises.push(bot.launch());

  promises.push(
    server.listen({
      host: process.env.HOST ? process.env.HOST : "0.0.0.0",
      port: process.env.PORT ? Number(process.env.PORT!) : 10000,
    }),
  );

  const stop = async () => process.exit(1);

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  process.on("uncaughtException", console.log);
  process.on("unhandledRejection", console.log);

  return Promise.all(promises);
}

const server = fastify({ logger: true, requestTimeout: 600000 });
const bot = new Telegraf(getEnv("TELEGRAM_BOT_API_KEY"), {
  handlerTimeout: 600000,
});

main(server, bot).catch((error) => {
  server.log.error(error);
  process.exit(1);
});
