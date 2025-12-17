import "dotenv/config";
import path from "path";
import dotenv from "dotenv";
import { format } from "util";
import { execSync } from "child_process";

if (process.env.NODE_ENV !== "production") {
  const root = execSync("git rev-parse --show-toplevel").toString().trim();
  dotenv.config({ path: path.resolve(root, ".env") });
  dotenv.config(); // local .env file have more priority than global .env file
}

type Env =
  | "PORT"
  | "HOST"
  | "REDIS_MASTER_NAME"
  | "REDIS_MAX_SENTINELS"
  | "REDIS_SENTINEL_PORT"
  | "REDIS_PASSWORD"
  | "AWS_KMS_KEY_ID"
  | "AWS_REGION"
  | "REDIS_URL"
  | "REDIS_SENTINEL_HOSTNAME"
  | "DATABASE_URL"
  | "COINGECKO_API_KEY"
  | "JITO_API_URL"
  | "JITO_UUID"
  | "HELIUS_API_URL"
  | "HELIUS_API_KEY"
  | "SOLANA_TRACKER_API_KEY"
  | "SECRET_KEY"
  | "SOLANA_RPC_URL"
  | "DEV_WALLET";

export function getEnv<T>(name: Env, refine?: <K>(value: K) => T): T;
export function getEnv<T>(
  name: Env,
  refine: (<K>(value: K) => T) | undefined,
  strict: boolean,
): T | undefined;
export function getEnv<T>(
  name: Env,
  refine?: <K>(value: K) => T,
  strict: boolean = true,
) {
  const value = process.env[name] || process.env[format("APP_%s", name)];
  if (value)
    try {
      const parsed = JSON.parse(value) as T;
      return refine ? (refine(parsed) as T) : parsed;
    } catch {
      return (refine ? refine(value) : value) as T;
    }
  if (strict) throw new Error(format("%s not found in env file", name));

  return undefined;
}
