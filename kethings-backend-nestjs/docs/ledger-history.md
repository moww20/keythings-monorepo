# Ledger History Backend Integration

This document explains the backend endpoints for retrieving Keeta ledger history, chain, and account-relevant operations.

## Overview

- **History**: vote staples that affected an account (incoming and outgoing).
- **Chain**: blocks issued by the account itself.
- **Relevant operations**: a filtered list of operations from staples that are relevant to a specific account.

The backend adheres to the zero-custody model: it never uses seeds/private keys. It uses the public key string to construct an account reference and queries Keeta via the SDK.

## Environment

- `KEETA_NETWORK` one of: `test` | `main` | `staging` | `dev`
- Default port: `4002` (see `src/main.ts`)

## Endpoints

Base path: `/api/ledger/v1/accounts/:publicKey`

- `GET /history?limit=NUMBER&includeOps=true|false`
  - Returns vote staples affecting the account.
  - `limit` optional, 1–100.
  - `includeOps` optional; when `true` includes operations filtered for the account.

- `GET /chain?limit=NUMBER`
  - Returns blocks issued by the account.
  - `limit` optional, 1–100.

- `GET /operations?limit=NUMBER`
  - Returns relevant operations (filtered from staples) for the account.
  - `limit` optional, 1–100.

## Example

Replace `<PUBLIC_KEY>` with a valid Keeta public key string.

```bash
# History (with relevant operations)
curl "http://localhost:4002/api/ledger/v1/accounts/<PUBLIC_KEY>/history?limit=20&includeOps=true"

# Chain (blocks issued by the account)
curl "http://localhost:4002/api/ledger/v1/accounts/<PUBLIC_KEY>/chain?limit=20"

# Relevant operations only
curl "http://localhost:4002/api/ledger/v1/accounts/<PUBLIC_KEY>/operations?limit=50"
```

## Implementation Notes

- Service: `src/ledger/ledger.service.ts`
  - Uses `KeetaNet.lib.Account.fromPublicKeyString(publicKey)`
  - Instantiates `UserClient` with `UserClient.fromNetwork(network, null, { account })`
  - Fetches:
    - `client.history()` → staples
    - `client.chain()` → blocks
    - `client.filterStapleOperations(staples, account)` → relevant ops
  - Normalizes fields with defensive helpers for stability.

- Controller: `src/ledger/ledger.controller.ts`
  - Routes for `/history`, `/chain`, `/operations`

- Module: `src/ledger/ledger.module.ts`
  - Provides `LedgerService`, `LedgerController`

## Zero-Custody Guarantee

- Backend never uses seeds or private keys.
- All on-chain operations are read-only queries.

## Development

1. Install deps (from `kethings-backend-nestjs/`):
   ```bash
   bun install
   ```
2. Build once:
   ```bash
   bun run build
   ```
3. Start prod:
   ```bash
   bun run start:prod
   ```

If you change code, rebuild once and restart prod. For live-reload development, use:
```bash
bun run start:dev
```
