import type { Context } from "telegraf";
import { makeTRPCClient } from "./trpc";

export const createContext = (_context: Context) => {
  const trpc = makeTRPCClient();

  return {
    trpc,
  };
};

export type BotContext = Context & Awaited<ReturnType<typeof createContext>>;
