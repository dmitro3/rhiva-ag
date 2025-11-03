import type z from "zod";
import moment from "moment";
import { format } from "util";
import type Redis from "ioredis";
import { eq } from "drizzle-orm";
import { Keypair } from "@solana/web3.js";
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
  ) {
    let user = await drizzle.query.users.findFirst({
      where: eq(users.uid, values.uid),
    });

    const setupUserAccount = async (user: typeof users.$inferSelect) => {
      const promises = [];
      const wallet = await drizzle.query.wallets.findFirst({
        where: eq(wallets.user, user.id),
      });

      if (!wallet) {
        const keypair = Keypair.generate();
        let wrappedDek: string | undefined, encryptedText: string;

        if (secret instanceof KMSSecret) {
          const { wrappedDek: dek, encryptedText: key } = await secret.encrypt(
            keypair.secretKey.toBase64(),
          );
          wrappedDek = dek;
          encryptedText = key;
        } else encryptedText = secret.encrypt(keypair.secretKey.toBase64());

        promises.push(
          drizzle
            .insert(wallets)
            .values({
              wrappedDek,
              key: encryptedText,
              user: user.id,
              id: keypair.publicKey.toBase58(),
            })
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

  abstract getUserFromSession(request: FastifyRequest): Promise<User | null>;

  abstract getUserFromHeader(request: FastifyRequest): Promise<User | null>;
}
