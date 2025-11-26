// @ts-nocheck
import type z from "zod";
import moment from "moment";
import { format } from "util";
import type Redis from "ioredis";
import { eq } from "drizzle-orm";
import { Keypair } from "@solana/web3.js";
import { assertIsAddress } from "@solana/kit";
import type { FastifyRequest } from "fastify";
import { KMSSecret, type Secret } from "@rhiva-ag/shared";
import {
  users,
  wallets,
  settings,
  rewards,
  type Database,
  type userInsertSchema,
} from "@rhiva-ag/datasource";

import type { User } from "./types";

export abstract class AuthMiddleware {
  constructor(
    protected readonly redis: Redis,
    protected readonly secret: KMSSecret | Secret,
    protected readonly drizzle: Database,
    protected readonly options?: {
      ttl?: number;
    },
  ) {}

  protected getCacheUserKey(sessionId: string) {
    return format("%s:user", sessionId);
  }

  static async upsertUser(
    drizzle: Database,
    secret: KMSSecret | Secret,
    values: z.infer<typeof userInsertSchema>,
    opts?: {
      externalWallet?: boolean;
      skipCreateWallet?: boolean;
    },
  ) {
    let user = await drizzle.query.users.findFirst({
      where: eq(users.uid, values.uid),
    });

    const setupUserAccount = async (user: typeof users.$inferSelect) => {
      const promises = [];
      const wallet = await drizzle.query.wallets.findFirst({
        where: eq(wallets.user, user.id),
      });

      if (!wallet && !opts?.skipCreateWallet) {
        let values: typeof wallets.$inferInsert;
        if (opts?.externalWallet) {
          assertIsAddress(user.uid);
          values = {
            user: user.id,
            id: user.uid,
            external: true,
          };
        } else {
          const keypair = Keypair.generate();
          let wrappedDek: string | undefined, encryptedText: string | undefined;

          if (secret instanceof KMSSecret) {
            const keypair = Keypair.generate();

            const { wrappedDek: dek, encryptedText: key } =
              await secret.encrypt(keypair.secretKey.toBase64());
            wrappedDek = dek;
            encryptedText = key;
          } else encryptedText = secret.encrypt(keypair.secretKey.toBase64());

          values = {
            wrappedDek,
            user: user.id,
            external: false,
            key: encryptedText,
            id: keypair.publicKey.toBase58(),
          };
        }

        promises.push(
          drizzle
            .insert(wallets)
            .values(values)
            .onConflictDoNothing({ target: [wallets.user] }),
        );
      }

      return Promise.all([
        ...promises,
        drizzle
          .insert(settings)
          .values({
            user: user.id,
          })
          .onConflictDoNothing({ target: [settings.user] }),
      ]);
    };
    const yesterday = moment().startOf("day").subtract(1, "day");
    const resetStreak = user
      ? !moment(user.lastLogin, "day").isSame(yesterday, "day")
      : false;
    const currentStreak = user ? (resetStreak ? 1 : user.currentStreak + 1) : 1;

    [user] = await drizzle
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          lastLogin: new Date(),
          currentStreak: currentStreak === 30 ? 1 : currentStreak,
        },
      })
      .returning();

    if (user) {
      await setupUserAccount(user);
      if (currentStreak === 7)
        await drizzle.insert(rewards).values({
          xp: 50,
          user: user.id,
          key: "7_days_streak",
        });
      if (currentStreak === 30)
        await drizzle.insert(rewards).values({
          xp: 100,
          user: user.id,
          key: "1_month_streak",
        });

      return drizzle.query.users.findFirst({
        with: {
          wallet: true,
          settings: true,
        },
        where: eq(users.uid, values.uid),
      });
    }

    return null;
  }

  async getUser(request: FastifyRequest): Promise<User | undefined | null> {
    const sessionUser = await this.getUserFromSession(request);
    if (sessionUser) return sessionUser;
    return this.getUserFromHeader(request);
  }

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

  abstract getUserFromHeader(request: FastifyRequest): Promise<User | null>;
}
