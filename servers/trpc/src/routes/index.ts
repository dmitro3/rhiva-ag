import type { FastifyInstance } from "fastify";
import registerAuthRoutes from "./auth/auth.route";
import { registerProxyRoutes } from "./proxy/proxy.route";

export default function registerRoutes(fastify: FastifyInstance) {
  registerAuthRoutes(fastify);
  registerProxyRoutes(fastify);
}
