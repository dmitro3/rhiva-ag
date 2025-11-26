import type z from "zod";
import moment from "moment";
import { sum, eq, getTableColumns, count } from "drizzle-orm";
import {
  add,
  caseWhen,
  coalesce,
  date,
  mul,
  rank,
  referrers,
  rewards,
  settings,
  users,
  wallets,
  count as countAll,
  type Database,
  type userSelectSchema,
} from "@rhiva-ag/datasource";

export const getUserById = async (
  db: Database,
  userId: z.infer<typeof userSelectSchema>["id"],
) => {
  const today = moment().startOf("day").toDate();
  const qRewards = db
    .select({
      user: rewards.user,
      xp: sum(rewards.xp).as("xp"),
      todayXp: sum(caseWhen(eq(date(rewards.createdAt), today), rewards.xp))
        .mapWith(Number)
        .as("todayXp"),
    })
    .from(rewards)
    .groupBy(rewards.user)
    .as("qRewards");

  const qReferrers = db
    .select({
      referer: referrers.referer,
      referXp: mul(sum(qRewards.xp), 0.1).as("referXp"),
      totalRefer: count(referrers.referer).as("totalRefer"),
    })
    .from(referrers)
    .where(eq(referrers.referer, userId))
    .leftJoin(qRewards, eq(qRewards.user, referrers.user))
    .groupBy(referrers.referer)
    .as("qReferrers");

  // performance issues todo
  const qRanks = db
    .select({
      id: users.id,
      totalUsers: countAll().mapWith(Number).as("totalUsers"),
      rank: rank(qRewards.xp).mapWith(Number).as("rank"),
      todayXp: coalesce(qRewards.todayXp, 0).mapWith(Number).as("todayXp"),
      referXp: coalesce(qReferrers.referXp, 0).mapWith(Number).as("referXp"),
      totalRefer: coalesce(qReferrers.totalRefer, 0)
        .mapWith(Number)
        .as("totalRefer"),
      xp: coalesce(add(qRewards.xp, qReferrers.referXp), 0)
        .mapWith(Number)
        .as("xp"),
    })
    .from(users)
    .leftJoin(referrers, eq(referrers.user, users.id))
    .leftJoin(qReferrers, eq(qReferrers.referer, users.id))
    .leftJoin(qRewards, eq(qRewards.user, users.id))
    .as("qRanks");

  const [[user], userWallets] = await Promise.all([
    db
      .select({
        ...qRanks._.selectedFields,
        ...getTableColumns(users),
        settings: getTableColumns(settings),
      })
      .from(users)
      .limit(1)
      .where(eq(users.id, userId))
      .leftJoin(qRanks, eq(qRanks.id, users.id))
      .innerJoin(settings, eq(settings.user, users.id)),
    db.select().from(wallets).where(eq(wallets.user, userId)),
  ]);
  if (user)
    return {
      ...user,
      wallets: userWallets,
      wallet: userWallets.find((wallet) => wallet.primary)!,
    };

  return null;
};
