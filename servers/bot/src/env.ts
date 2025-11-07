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

type Env = "TELEGRAM_BOT_API_KEY";

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
