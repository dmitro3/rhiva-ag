import { format } from "util";
import type { RedisClient } from "bullmq";

export function getChannelId(uniqueId: string) {
  return format("rhiva:events:%s", uniqueId);
}

export async function sendEvent<T extends object>(
  redis: RedisClient,
  uniqueId: string,
  value: T,
) {
  const channelId = getChannelId(uniqueId);
  const data = JSON.stringify(value);

  await Promise.all([
    await redis.setex(channelId, 60_000, data),
    await redis.publish(channelId, data),
  ]);
}
