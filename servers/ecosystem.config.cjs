const path = require("path");
const { readdirSync } = require("fs");

require("dotenv").config();

const os = require("os");
const { execSync } = require("child_process");
const { format } = require("util");

const interpreter = execSync("which bun").toString().trim();

const scriptPath = "cron/src/workers";
const workerScripts = readdirSync(scriptPath, { recursive: true });

const workerEntries = workerScripts
  .filter((script) => /worker.*$/.test(script))
  .map((script) => ({
    interpreter,
    exec_mode: "fork",
    script: path.join(scriptPath, script),
    name: format("%s-worker", script.split(/.worker.*$/)[0]),
    instances: Math.min(3, Math.round(os.cpus().length / 2)),
  }));

module.exports = {
  apps: [
    {
      interpreter,
      instances: 1,
      name: "trpc",
      exec_mode: "fork",
      increment_var: "PORT",
      script: "trpc/src/index.ts",
      env: {
        PORT: 8000,
        APP_PORT: 8000,
      },
    },
    {
      interpreter,
      instances: 1,
      name: "mcp",
      exec_mode: "fork",
      increment_var: "PORT",
      script: "mcp/src/index.ts",
      env: {
        PORT: 8001,
        APP_PORT: 8001,
      },
    },
    {
      interpreter,
      instances: 1,
      name: "schedules",
      exec_mode: "fork",
      script: "cron/src/schedules/index.ts",
    },
    ...workerEntries,
  ],
};
