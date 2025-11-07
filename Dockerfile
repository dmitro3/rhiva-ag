# syntax = docker/dockerfile:1.2

FROM oven/bun:latest as base

ENV NODE_ENV="production"
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y curl unzip bash ca-certificates

RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
RUN unzip awscliv2.zip
RUN ./aws/install

ENV PATH="/root/.bun/bin:$PATH"

FROM base as codegen
WORKDIR /usr/src/app

# Copy source code
COPY packages ./packages
COPY servers ./servers
COPY turbo.json ./turbo.json
COPY bun.lock ./bun.lock
COPY package.json ./package.json

# Run turbo prune for docker build
RUN bun x turbo prune @rhiva-ag/trpc @rhiva-ag/cron @rhiva-ag/mcp --docker

FROM base as builder
WORKDIR /usr/src/app

COPY --from=codegen /usr/src/app/out/json .
RUN --mount=type=cache,target=/root/.bun/cache\
  BUN_NO_POSTINSTALL=1 bun install --frozen-lockfile --production

COPY --from=codegen /usr/src/app/out/full .
COPY --from=codegen /usr/src/app/servers/ecosystem.config.js servers/ecosystem.config.js

FROM base as runtime
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/ .

FROM runtime as dev
WORKDIR /usr/src/app
CMD sh -c "cd packages/datasource && \
  bun x drizzle-kit migrate && \
  cd ../../servers && \
  bun x pm2-runtime start ecosystem.config.js"

FROM runtime as trpc
WORKDIR /usr/src/app/servers/trpc
CMD ["bun", "src/index.ts"]

FROM runtime as schedules
WORKDIR /usr/src/app/servers/cron
CMD sh -c "bun src/schedules/index.ts"

FROM runtime as workers
WORKDIR /usr/src/app/servers/cron
CMD sh -c "bun src/workers/index.ts"

FROM runtime as mcp
WORKDIR /usr/src/app/servers/mcp
CMD sh -c "bun src/index.ts"