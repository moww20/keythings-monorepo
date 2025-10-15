# Trade Page → RFQ Conversion Plan

## Objective
Transform the existing Trade page into a Request-for-Quote (RFQ) native experience that keeps the familiar limit-order workflow while unlocking peer-to-peer atomic settlement. The page must let market makers post signed RFQ limit quotes and takers fill them in a single signing flow with automatic maker confirmation and sub-400 ms Keeta settlement.

## Guiding Principles
- **Limit order mindset** – Makers express quotes as price + size with optional taker allowlists. Takers interact with an order book that feels familiar to CLOB users.
- **True RFQ settlement** – Every fill executes as a Keeta atomic swap using `send`/`receive`; no pool storage accounts or AMM math.
- **Non-custodial guarantees** – Both parties sign their side; backend only distributes unsigned/partially-signed blocks and records status.
- **Automation ready** – Market makers can run bots that post quotes and auto-sign fills. Retail takers use the browser UI to browse, select, and sign.

## Personas & Core Flows

### Maker (Quote poster)
1. Connect wallet → switch Trade page to **RFQ Maker** tab.
2. Configure quote (pair, side, price, size, expiry, optional taker allowlist).
3. Client builds RFQ transaction template (unsigned block) with maker leg + taker leg placeholders.
4. Maker signs the maker leg locally (producing a partially-signed block) and posts quote via `/api/rfq/orders/create`.
5. Background quote bot watches fill events and, upon taker signature, co-signs the taker leg using the wallet’s delegated auto-signer to finalize.

### Taker (Order filler)
1. Browse RFQ order book stream → filter by pair, side, expiry.
2. Select preferred quote → review effective price, slippage, expiry, maker rating.
3. Click **Fill RFQ** → wallet signs taker leg (send + receive) against maker’s partially-signed block.
4. Quote service notifies maker’s auto-signer. Maker signature finalizes block; Keeta publishes and settles atomically (<400 ms).
5. UI transitions to settlement confirmation with explorer link and ledger update.

## Trade Page Information Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ Pair Selector | Mode Tabs: [Spot CLOB] [RFQ Taker] [RFQ Maker] │
├────────────────────────────────────────────────────────────────┤
│ Left Column (60%)                                              │
│ ├─ Live Chart (shared component)                               │
│ ├─ Depth View                                                  │
│ └─ RFQ Order Book                                              │
│    • Toggle between Bids / Asks                                │
│    • Group by price level, show maker, min/max fill, expiry    │
│    • Visual badges: Maker verified, counterparty allowlisted   │
├────────────────────────────────────────────────────────────────┤
│ Right Column (40%)                                             │
│ ├─ RFQ Taker Panel                                             │
│ │  - Selected quote summary                                   │
│ │  - Editable partial fill amount (respect min/max)           │
│ │  - Settlement preview (fees, net receive)                   │
│ │  - Sign & Fill button                                       │
│ └─ RFQ Maker Panel (tabbed)                                   │
│    - Quote builder form                                       │
│    - Preview unsigned block bytes                             │
│    - Publish quote                                             │
└────────────────────────────────────────────────────────────────┘
```

## Data & State Management
- **Order feed**: `useRFQOrderBook` hook consumes `/api/rfq/orderbook:{pair}` WebSocket; maintains `open`, `pending_fill`, `filled`, `expired` buckets.
- **Quote selection state**: central `RFQContext` provides `selectedOrder`, `fillAmount`, and `makerMeta` to taker panel.
- **Maker draft state**: persisted locally (`zustand` slice) so quote forms survive navigation; stores price/size presets and expiry templates.
- **Auto-update**: optimistic UI marks quote as `pending_fill` immediately after taker signs; resets to `open` if maker auto-sign fails within SLA.

## RFQ Limit Order Specification
| Field | Description | Source |
|-------|-------------|--------|
| `order_id` | UUID v7 assigned server-side | Backend |
| `side` | `buy` (maker buys base) / `sell` | Maker input |
| `price` | Fixed unit price (quote/base) | Maker input |
| `size` | Base asset quantity | Maker input |
| `min_fill` | Optional minimum taker size | Maker input |
| `expiry` | ISO timestamp ≤ 24h | Maker input |
| `maker_signature` | Maker’s partial block signature | Client wallet |
| `unsigned_block` | Base64 encoded block containing both legs | Client wallet |
| `maker_auto_sign_webhook` | Endpoint invoked when taker signs | Maker bot registration |

## Interaction Sequence (Taker Fill)
1. **Select order** – UI fetches latest snapshot from REST for deterministic parameters.
2. **Pre-flight validation** – frontend checks taker balance via wallet, expiry window (>30 s remaining), `fillAmount` within range.
3. **Compose taker leg** – create builder from `unsigned_block`, insert taker send/receive instructions, ensure price invariants.
4. **Wallet signature** – taker signs; builder publishes to Keeta pending co-sign.
5. **Maker auto-sign** – backend emits `order.fill_requested` event with taker signature; maker bot confirms availability and submits final signature via `/api/rfq/orders/:id/fill`.
6. **Settlement confirmation** – backend listens to Keeta settlement webhook; marks order `filled`, pushes WebSocket update to both parties.

## Backend Enhancements
- Extend `order_book.rs` to accept partially-signed blocks and track maker webhook URLs / capabilities.
- Implement `/api/rfq/orders/:id/fill-request` that stores taker signature, enqueues event for maker auto-signer, and starts SLA timer.
- Add settlement watcher that verifies Keeta block finality and publishes completion events to WebSocket channels (`rfq:fills:{order_id}` & `orders:{user}`).
- Introduce failure handling: if maker auto-sign SLA (e.g., 5 s) lapses, backend flips order back to `open` and notifies taker; repeated failures downgrade maker reputation.

## Maker Auto-Sign Patterns
- Makers register an **auto-sign profile** (`POST /api/rfq/makers/register`) specifying webhook URL, signing SLA, and supported pairs.
- When posting a quote, maker includes profile ID; backend ensures auto-sign channel is healthy via heartbeat.
- Auto-sign bot flow:
  1. Receive `fill_requested` payload (order_id, taker_pubkey, taker_signature, block_bytes).
  2. Recompute quote invariants (price, balances) and sign using Keeta SDK service key.
  3. Call `/api/rfq/orders/:id/confirm` with maker co-signature → backend publishes to Keeta.
  4. Receive finality notification and reconcile inventory.

## Security & Compliance Considerations
- **Signature matching** – backend verifies taker-modified block still matches maker quote before relaying to maker bot.
- **Replay protection** – `fill_nonce` appended to block metadata; backend rejects duplicate fills.
- **Rate limiting** – limit taker fill attempts per minute and maker quote posts per IP/key to prevent spam.
- **Audit trail** – persist full quote + fill history for compliance exports; link UI fills to explorer transactions.
- **Reputation scoring** – derive maker reliability metrics (fill success %, SLA breaches) to surface badges in UI.

## Implementation Phases
1. **Foundation (Backend)**
   - Extend RFQ order model for partial signatures, taker fill requests, and maker auto-sign profiles.
   - Ship WebSocket topics for RFQ order list + fill lifecycle.
2. **Taker Experience**
   - Build RFQ order book list with sorting, filtering, and selection.
   - Implement taker fill modal integrated with Keeta wallet signing.
3. **Maker Experience**
   - Add quote creation tab with live validation, expiry presets, and preview of encoded block.
   - Support draft saving and quick quote duplication.
4. **Automation & Reliability**
   - Deliver maker webhook spec, reference auto-sign bot, SLA monitoring, and reputation metrics.
5. **Testing & Launch**
   - End-to-end Cypress flow (maker quote → taker fill → settlement confirmation).
   - Load test order book streams and SLA enforcement.
   - Security review covering signature validation, expiry handling, and replay prevention.

## Success Metrics
- ≥95 % maker fills co-signed within 5 s of taker signature.
- <1 % RFQ fills reverting to `open` due to maker SLA breaches.
- Average taker fill experience time (select → confirmation) ≤ 10 s.
- RFQ adoption: ≥30 % of total Trade page volume within first quarter post-launch.

---
This plan aligns with the existing RFQ order book architecture documents and focuses specifically on reshaping the Trade page UX, data flows, and automation needed to deliver a frictionless RFQ trading experience.
