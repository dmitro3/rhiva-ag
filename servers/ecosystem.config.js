require("dotenv").config();

const os = require("os");
const { execSync } = require("child_process");

const interpreter = execSync("which bun").toString().trim();

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
    {
      interpreter,
      name: "workers",
      exec_mode: "fork",
      script: "cron/src/workers/index.ts",
      instances: Math.min(3, Math.round(os.cpus().length / 2)),
    },
  ],
};
