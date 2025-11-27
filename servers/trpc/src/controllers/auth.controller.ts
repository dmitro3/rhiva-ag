// @ts-nocheck
import type z from "zod";
import moment from "moment";
import { format } from "util";
import type Redis from "ioredis";
import { eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import {
  users,
  settings,
  rewards,
  type Database,
  type userInsertSchema,
  type userSelectSchema,
} from "@rhiva-ag/datasource";

import type { User } from "./types";

export abstract class AuthMiddleware {
  constructor(
    protected readonly redis: Redis,
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
    values: z.infer<typeof userInsertSchema>,
    onCreateUser?: (user: z.infer<typeof userSelectSchema>) => Promise<unknown>,
  ) {
    let user = await drizzle.query.users.findFirst({
      where: eq(users.uid, values.uid),
    });

    const maxStreak = moment(user?.lastLogin).daysInMonth();
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
          currentStreak: currentStreak >= maxStreak ? 1 : currentStreak,
        },
      })
      .returning();

    if (user) {
      await drizzle
        .insert(settings)
        .values({
          user: user.id,
        })
        .onConflictDoNothing({ target: [settings.user] });
      if (currentStreak === 7)
        await drizzle.insert(rewards).values({
          xp: 50,
          user: user.id,
          key: "7_days_streak",
        });
      else if (currentStreak >= maxStreak)
        await drizzle.insert(rewards).values({
          xp: 100,
          user: user.id,
          key: "1_month_streak",
        });
      await onCreateUser?.(user);
      const result = await drizzle.query.users.findFirst({
        with: {
          wallets: true,
          settings: true,
        },
        where: eq(users.uid, values.uid),
      });
      if (result) {
        const primaryWallet = result.wallets.find((wallet) => wallet.primary);
        if (primaryWallet)
          return {
            ...result,
            wallet: primaryWallet,
          };

        throw new Error("no primary wallet found.");
      }
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
