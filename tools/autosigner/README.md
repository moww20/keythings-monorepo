# Keythings RFQ Maker Autosigner

This Bun script polls the Keythings RFQ API for taker fill requests and automatically co-signs them on the Keeta testnet. It is
 designed for market makers who publish partially signed RFQ quotes and delegate final signature responsibilities to an
 automation bot.

## Configuration

Set the following environment variables before running the autosigner:

| Variable | Description |
| --- | --- |
| `AUTOSIGNER_API_URL` | Base URL for the Keythings RFQ API (defaults to `https://testnet.api.keythings.xyz`). |
| `AUTOSIGNER_PROFILE_ID` | Maker profile identifier returned by the RFQ API. |
| `AUTOSIGNER_ACCOUNT_SEED` | Hex-encoded seed used to derive the maker signing account. |
| `AUTOSIGNER_ACCOUNT_INDEX` | Optional derivation index for the seed (defaults to `0`). |
| `AUTOSIGNER_NETWORK` | Keeta network alias (defaults to `test`). |
| `AUTOSIGNER_POLL_INTERVAL_MS` | Poll interval in milliseconds (defaults to `2000`). |
| `AUTOSIGNER_BATCH_SIZE` | Maximum number of queued fill requests fetched per poll (defaults to `10`). |

## Running

Install dependencies (if you have not already):

```bash
bun install
```

Then start the autosigner:

```bash
AUTOSIGNER_PROFILE_ID=maker-123 \
AUTOSIGNER_ACCOUNT_SEED=0000000000000000000000000000000000000000000000000000000000000000 \
AUTOSIGNER_API_URL=https://testnet.api.keythings.xyz \
AUTOSIGNER_NETWORK=test \
BUN_DEBUG_DISABLE_ERROR_TRACES=1 \
bun tools/autosigner/index.ts
```

The bot logs each fill request and reports whether the Keeta transaction was published successfully. Failures are acknowledged
 with the RFQ API so the order can be re-opened or flagged for manual review.
