import type z from "zod";
import jwt from "jsonwebtoken";
import { SignMessage } from "@rhiva-ag/shared";
import { getAuth } from "firebase-admin/auth";
import { createDB } from "@rhiva-ag/datasource";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { getEnv } from "../../env";
import { secret } from "../../instances";
import { getUserById } from "../../routers/users/user.controller";
import { AuthMiddleware } from "../../controllers/auth.controller";
import {
  firebaseTokenAuthSchema,
  safeAuthUserSchema,
  walletAuthSchema,
} from "./auth.schema";

const db = createDB(getEnv("DATABASE_URL"));

const walletSignInRoute = async (
  request: FastifyRequest<{ Body: z.infer<typeof walletAuthSchema> }>,
  reply: FastifyReply,
) => {
  const data = walletAuthSchema.parse(request.body);
  const signInMessage = new SignMessage(data.message);
  const isValid = await signInMessage.validate(data.signature);
  if (isValid) {
    const user = await AuthMiddleware.upsertUser(
      db,
      secret,
      {
        uid: data.message.publicKey,
      },
      { externalWallet: true },
    );

    if (user) {
      const extendedUser = await getUserById(db, user.id);
      const token = jwt.sign({ user: user.uid }, getEnv<string>("SECRET_KEY"), {
        expiresIn: 25_200,
      });

      return safeAuthUserSchema.parse({ token, ...extendedUser });
    }
  }

  return reply.status(401).send("UNAUTHORIZED");
};

const firebaseTokenSignInRoute = async (
  request: FastifyRequest<{ Body: z.infer<typeof firebaseTokenAuthSchema> }>,
  reply: FastifyReply,
) => {
  const data = firebaseTokenAuthSchema.parse(request.body);
  const auth = getAuth();
  const decodedUser = await auth.verifyIdToken(data.token, true);
  const user = await AuthMiddleware.upsertUser(db, secret, {
    uid: decodedUser.uid,
    email: decodedUser.email,
  });

  if (user) {
    const extendedUser = await getUserById(db, user.id);
    const token = jwt.sign({ user: user.uid }, getEnv<string>("SECRET_KEY"), {
      expiresIn: 25200,
    });
    return safeAuthUserSchema.parse({ token, ...extendedUser });
  }

  return reply.status(401).send("UNAUTHORIZED");
};

export default function registerAuthRoutes(fastify: FastifyInstance) {
  fastify
    .route({
      method: "POST",
      url: "/auth/wallet",
      handler: walletSignInRoute,
    })
    .route({
      method: "POST",
      url: "/auth/firebase",
      handler: firebaseTokenSignInRoute,
    });
}
