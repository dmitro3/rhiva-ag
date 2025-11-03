// @ts-nocheck

import { eq } from "drizzle-orm";
import jwt, { type Jwt } from "jsonwebtoken";
import { users } from "@rhiva-ag/datasource";
import type { FastifyRequest } from "fastify";

import { getEnv } from "../env";
import type { User } from "./types";
import { AuthMiddleware } from "./auth.controller";

export class JWTAuthMiddleware extends AuthMiddleware {
  async getUserFromSession(request: FastifyRequest): Promise<User | null> {
    const sessionId = request.session.sessionId;
    const key = this.getCacheUserKey(sessionId);
    const cachedUser = await this.redis.get(key);
    if (cachedUser) {
      const decodedUser: { user: string } = JSON.parse(cachedUser);
      const user = await this.drizzle.query.users.findFirst({
        where: eq(users.id, decodedUser.user),
        with: {
          wallet: true,
          settings: true,
        },
      });

      if (user) return user;
    }
    return null;
  }

  async getUserFromHeader(request: FastifyRequest) {
    const authorization = request.headers.authorization;
    if (authorization) {
      const [, token] = authorization.split(/\s/g);
      let payload: (Jwt & { user?: string }) | undefined | null;

      if (token) payload = jwt.decode(token, getEnv("SECRET_KEY"));
      if (payload?.user) {
        const user = await AuthMiddleware.upsertUser(
          this.drizzle,
          this.secret,
          {
            uid: payload.user,
          },
        );

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
