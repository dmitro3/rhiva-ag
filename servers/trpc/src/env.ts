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
  | "REDIS_MAX_SENTINELS"
  | "REDIS_MASTER_NAME"
  | "REDIS_SENTINEL_PORT"
  | "REDIS_URL"
  | "REDIS_SENTINEL_HOSTNAME"
  | "REDIS_PASSWORD"
  | "STATIC_REFERRAL_CODE"
  | "MCP_SERVER_URL"
  | "COINGECKO_API_KEY"
  | "CIVIC_CLIENT_ID"
  | "DATABASE_URL"
  | "JITO_API_URL"
  | "JITO_UUID"
  | "HELIUS_API_URL"
  | "HELIUS_API_KEY"
  | "SOLANA_TRACKER_API_KEY"
  | "SECRET_KEY"
  | "SOLANA_RPC_URL"
  | "AWS_REGION"
  | "AWS_KMS_KEY_ID"
  | "DEV_WALLET"
  | "OPEN_API_KEY"
  | "FIREBASE_SERVICE_KEY";

export const getEnv = <T>(name: Env, refine?: <K>(value: K) => T): T => {
  const value = process.env[name] || process.env[format("APP_%s", name)];
  if (value)
    try {
      const parsed = JSON.parse(value) as T;
      return refine ? (refine(parsed) as T) : parsed;
    } catch {
      return (refine ? refine(value) : value) as T;
    }
  throw new Error(format("%s not found in env file", name));
};
