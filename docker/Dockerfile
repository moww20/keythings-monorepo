FROM rust:1.82 as builder

WORKDIR /usr/src/keythings-dapp-engine
COPY Cargo.toml Cargo.lock ./
COPY src ./src

# Build release binary
RUN cargo build --release

# Runtime image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /usr/src/keythings-dapp-engine/target/release/keythings-dapp-engine /usr/local/bin/keythings-dapp-engine

EXPOSE 8080
ENTRYPOINT ["keythings-dapp-engine"]
