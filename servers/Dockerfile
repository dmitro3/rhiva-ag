# syntax = docker/dockerfile:1.2
# for christ sake don't edit this file unless you know what you're doing 

FROM oven/bun:1.3.4 as base

ARG GITHUB_TOKEN
ENV NODE_ENV="production"

RUN apt-get update \
  && apt-get install -y curl unzip bash ca-certificates redis-tools

RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
RUN unzip awscliv2.zip
RUN ./aws/install

ENV PATH="/root/.bun/bin:$PATH"

FROM base as codegen
WORKDIR /usr/src/app

# Copy source code
COPY bin ./bin
COPY servers ./servers
COPY packages ./packages
COPY bun.lock ./bun.lock
COPY turbo.json ./turbo.json
COPY bunfig.toml ./bunfig.toml
COPY package.json ./package.json

# Run turbo prune for docker build
RUN bun x turbo prune @rhiva-ag/trpc @rhiva-ag/cron @rhiva-ag/mcp --docker

FROM base as builder
WORKDIR /usr/src/app

COPY --from=codegen /usr/src/app/bin ./bin
COPY --from=codegen /usr/src/app/bunfig.toml .

COPY --from=codegen /usr/src/app/out/full .
RUN --mount=type=cache,target=/root/.bun/cache\
  bun install --frozen-lockfile

# COPY --from=codegen /usr/src/app/out/full .

RUN bun x turbo run build

FROM builder as dev
WORKDIR /usr/src/app
CMD sh -c ""