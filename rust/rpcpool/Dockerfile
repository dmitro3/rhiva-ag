FROM rust:1.91.0 AS builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev

WORKDIR /usr/src/app
COPY . .
RUN cargo build --features=seed --release
RUN mkdir outputs
RUN mv target/release/rpcpool outputs/rpcpool-seed
RUN cargo build --release
RUN mv target/release/rpcpool outputs/rpcpool

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/outputs .
ENV RUST_LOG=info
CMD ["sh", "-c", "./rpcpool-seed & ./rpcpool"]
