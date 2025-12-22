FROM rust:1.91.0 AS builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev

WORKDIR /usr/src/app
COPY . .
RUN cargo run --features=seed --release
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/target/release/rpcpool .
ENV RUST_LOG=debug
CMD ["./rpcpool"]
