// @ts-nocheck
import type { FastifyRequest } from "fastify";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

import { AuthMiddleware } from "./auth.controller";

export class FirebaseAuthMiddleware extends AuthMiddleware {
  async getUserFromHeader(request: FastifyRequest) {
    const authorization = request.headers.authorization;
    if (authorization) {
      const [tag, token] = authorization.split(/\s/g);
      let payload: DecodedIdToken | undefined;

      const auth = getAuth();
      if (token && tag) {
        if (token)
          if (tag === "Session")
            payload = await auth.verifySessionCookie(token, true);
          else payload = await auth.verifyIdToken(token, true);
      }

      if (payload) {
        const user = await AuthMiddleware.upsertUser(this.drizzle, {
          uid: payload.uid,
          email: payload.email,
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
