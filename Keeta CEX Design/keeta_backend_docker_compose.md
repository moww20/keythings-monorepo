# Docker Compose Setup for Keeta CEX Backend

This minimal setup runs the **Rust (Actix-web)** backend in Docker, exposing port **8080**.

> Structure
```
docker/
├─ docker-compose.yml
└─ Dockerfile
```

---

## docker-compose.yml
```yaml
version: "3.9"

services:
  keeta-backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: keeta_backend
    ports:
      - "8080:8080"
    environment:
      - RUST_LOG=info
    restart: unless-stopped
    volumes:
      - .:/app
```

---

## Dockerfile
```dockerfile
FROM rust:1.81 as builder

WORKDIR /usr/src/keeta-backend
COPY . .

# Build release binary
RUN cargo build --release

# Runtime image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /usr/src/keeta-backend/target/release/keeta-backend /usr/local/bin/keeta-backend

EXPOSE 8080
ENTRYPOINT ["keeta-backend"]
```

---

### Running

```bash
cd docker
docker compose up --build
```

This will start the Actix-web backend on **http://localhost:8080**.

If you’d like to also run a fake Keeta RPC mock (port 9090), add this service:

```yaml
  keeta-rpc-mock:
    image: kennethreitz/httpbin
    container_name: keeta_rpc_mock
    ports:
      - "9090:80"
```

Then your backend will resolve `KeetaRpc::new("http://keeta-rpc-mock:80")` automatically inside Docker.
