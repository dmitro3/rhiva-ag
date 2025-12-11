import { Redis, type RedisOptions } from "ioredis";

type Option = {
  port: number;
  host: string;
} & RedisOptions;

export function createRedis(url: string, options: RedisOptions): Redis;
export function createRedis(options: Option): Redis;
export function createRedis(option: string | Option, others?: RedisOptions) {
  if (typeof option === "object") {
    const { host, port, ...options } = option;
    return new Redis({
      sentinels: [
        {
          host: host,
          port: port,
        },
      ],
      ...options,
    });
  }

  // @ts-expect-error don't check type here
  return new Redis(option, others);
}
