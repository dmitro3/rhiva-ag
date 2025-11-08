import path from "path";
import { readFileSync } from "fs";
import { sleep } from "@rhiva-ag/shared";
import { Agent, type MCPServerStreamableHttp } from "@openai/agents";

import { __srcdir } from "./instances";
import { agentOutputSchema } from "./schema/agent.schema";

export class McpClientConnectionError extends Error {}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: Timer;

  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new McpClientConnectionError("Connect timeout")),
        ms,
      );
    }),
  ]);
}

export class McpClient {
  connected: boolean;
  private connectionTime!: number;
  private connecting: Promise<boolean> | null;

  constructor(
    private readonly server: MCPServerStreamableHttp,
    private readonly config: {
      name: string;
      maxRetries?: number | null;
      maxConnectionAge?: number | null;
      connectionTimeout?: number | null;
      retryStrategy?: (retries: number) => number;
    },
  ) {
    this.connecting = null;
    this.connectionTime = 0;
    this.connected = false;
  }

  get isConnected() {
    const maxConnectionAge =
      this.config.maxConnectionAge === null
        ? Infinity
        : this.config.maxConnectionAge
          ? this.config.maxConnectionAge
          : 3_600_000;
    return (
      this.connected && Date.now() - this.connectionTime < maxConnectionAge
    );
  }

  async connect() {
    if (this.isConnected) return true;
    if (this.connecting) return this.connecting;

    await this.close();

    this.connecting = (async () => {
      let retries = 0;
      const maxRetries =
        this.config.maxRetries === null
          ? Infinity
          : this.config.maxRetries
            ? this.config.maxRetries
            : 20;
      while (retries < maxRetries) {
        try {
          const timeout =
            this.config.connectionTimeout === null
              ? Infinity
              : this.config.connectionTimeout
                ? this.config.connectionTimeout
                : 30_000;
          await withTimeout(this.server.connect(), timeout);
          this.connected = true;
          this.connectionTime = Date.now();
          break;
        } catch (error) {
          console.error(error);
          retries += 1;

          if (retries < maxRetries) {
            const backoffMs = this.config.retryStrategy
              ? this.config.retryStrategy(retries)
              : Math.min(5000 * Math.pow(2, retries - 1), 30000);
            await sleep(backoffMs);
          }
        }
      }
      return false;
    })().finally(() => {
      this.connecting = null;
    });

    return this.connecting;
  }

  async close() {
    if (this.connected) {
      await this.server.close().catch(() => void 0);
      this.connected = false;
      this.connecting = null;
    }
  }

  async createAgent(
    params?: Omit<
      ConstructorParameters<typeof Agent>[number],
      "name" | "mcpServers" | "outputType" | "instructions"
    >,
    context?: string,
  ) {
    const isConnected = await this.connect();
    let instructions = readFileSync(
      path.join(__srcdir, "prompts/en/web3.txt"),
      "utf-8",
    );
    if (context) instructions = instructions.replace("%user_context%", context);

    if (isConnected || this.isConnected) {
      const agent = new Agent({
        ...params,
        name: this.config.name,
        model: "gpt-4o-mini",
        mcpServers: [this.server],
        // @ts-expect-error zod type not satisfied
        outputType: agentOutputSchema,
        instructions,
      });

      return agent;
    }

    throw new McpClientConnectionError("Failed to connect to mcp server.");
  }
}
