# syntax = docker/dockerfile:1.2

FROM oven/bun:latest as base

ENV NODE_ENV="production"

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
RUN bun install turbo --global && \
    bun x turbo prune @rhiva-ag/trpc @rhiva-ag/cron @rhiva-ag/mcp --docker

FROM base as builder
WORKDIR /usr/src/app

COPY --from=codegen /usr/src/app/out/json .
RUN --mount=type=cache,target=/root/.bun/cache\
    bun install --frozen-lockfile

COPY --from=codegen /usr/src/app/out/full . 
COPY --from=codegen /usr/src/app/servers/ecosystem.config.js servers/ecosystem.config.js

FROM base as runtime
WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/ .

ENV HOST="0.0.0.0"
ENV NODE_ENV=production

FROM runtime as dev
WORKDIR /usr/src/app
RUN bun install pm2 drizzle-kit --global
CMD sh -c "cd packages/datasource && \
  bun x drizzle-kit migrate && \
  cd ../../servers && \
  pm2-runtime start ecosystem.config.js"

FROM runtime as trpc 
WORKDIR /usr/src/app/servers/trpc
CMD ["bun", "src/index.ts"]

FROM runtime as cron 
WORKDIR /usr/src/app/servers/cron
CMD sh -c "bun src/schedules/index.ts & bun src/workers/index.ts"

FROM runtime as mcp
WORKDIR /usr/src/app/servers/mcp
CMD sh -c "bun src/index.ts"
