// @ts-nocheck
import jwt, { type Jwt } from "jsonwebtoken";
import type { FastifyRequest } from "fastify";

import { getEnv } from "../env";
import { AuthMiddleware } from "./auth.controller";

export class JWTAuthMiddleware extends AuthMiddleware {
  async getUserFromHeader(request: FastifyRequest) {
    const authorization = request.headers.authorization;
    if (authorization) {
      const [, token] = authorization.split(/\s/g);
      let payload: (Jwt & { user?: string }) | undefined | null;

      if (token) payload = jwt.decode(token, getEnv("SECRET_KEY"));
      if (payload?.user) {
        const user = await AuthMiddleware.upsertUser(this.drizzle, {
          uid: payload.user,
        });

        const sessionId = request.session.sessionId;
        const key = this.getCacheUserKey(sessionId);
        if (user)
          await this.redis.set(
            key,
            JSON.stringify({ user: user.id }),
            "EX",
            this.options?.ttl ?? 3_600,
          );
        if (user) return user;
      }
    }

    return null;
  }
}
