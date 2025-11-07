import { z } from "zod/mini";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { FastifyInstance } from "fastify/types/instance";

const proxyRoute = async (
  request: FastifyRequest<{ Querystring: { url: string } }>,
  reply: FastifyReply,
) => {
  const url = request.query.url;
  if (z.url().safeParse(url).success) {
    const response = await fetch(url);
    const headers: Record<string, string> = {};
    const skip = [
      "content-encoding",
      "transfer-encoding",
      "access-control-allow-origin",
      "access-control-allow-methods",
      "access-control-allow-headers",
      "access-control-allow-credentials",
    ];
    response.headers.forEach((value, key) => {
      if (skip.includes(key.toLowerCase())) return;
      headers[key] = value;
    });

    const text = await response.text();
    return reply.status(response.status).headers(headers).send(text);
  }

  return reply.status(400).send({
    message: "invalid url",
  });
};

export function registerProxyRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "GET",
    url: "/proxy/",
    schema: {
      querystring: {
        type: "object",
        required: ["url"],
        properties: {
          url: {
            type: "string",
          },
        },
      },
    },
    handler: proxyRoute,
  });
}
