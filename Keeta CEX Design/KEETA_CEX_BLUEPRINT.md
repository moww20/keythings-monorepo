# Keeta CEX Blueprint

## 1. Product Vision
- Deliver a hybrid exchange that unifies a professional CLOB, AMM liquidity pools, and a smart router so every order gets best execution without sacrificing self-custody.
- Target 400 ms settlement on Keeta Network with capacity for 10 M TPS while preserving regulatory-friendly, non-custodial flows.
- Serve three audiences simultaneously: traders (tight spreads, fast fills), liquidity providers (passive fee income), and market makers (API-driven depth).

## 2. Non-Custodial Core Principles
1. **Users sign every transaction.** The frontend builds unsigned instructions and the Keeta wallet extension signs/publishes them; the backend never holds an operator key.
2. **Wallet-first identity.** All pool, liquidity, and trading calls require the caller’s Keeta wallet address; demo users and seeded balances were removed.
3. **Scoped permissions.** Storage accounts grant `OWNER` to the user and scoped `SEND_ON_BEHALF`, `STORAGE_DEPOSIT`, and `STORAGE_CAN_HOLD` rights to the exchange only for approved tokens.
4. **Temporary safeguards.** Until live Keeta balance queries ship, new wallets are auto-credited in the internal ledger so real wallets can exercise flows without blocking tests.
5. **Auditability.** Every action leaves an on-chain trail, and reconciliation is designed to compare ledger vs. Keeta state on a fixed schedule with auto-pause safety.

## 3. System Architecture
### 3.1 Frontend (Next.js + Keeta Wallet)
- Wallet context exposes `publicKey`, token balances, and synchronous access to `userClient` (fixed via `useMemo` to remove race conditions).
- Create/Add/Remove liquidity modals enforce wallet connection, show real wallet balances, drive a three-step wizard, and surface settlement status (creating → settling → complete).
- Pool creation pipeline: gather parameters → call transaction builder helpers → request wallet signature → publish block → notify backend for state sync → render explorer links.

### 3.2 Backend (Rust, Actix-web)
- **Auth:** Challenge/response keyed to Keeta pubkeys.
- **Order Gateway & CLOB:** Validates orders, maintains price-time priority book, emits fills.
- **Pool Manager:** Manages constant-product, stable-swap, and weighted pools; tracks on-chain metadata, pause state, and LP supply.
- **Ledger:** Double-entry tracker per `(wallet, token)` with reserve/debit semantics and rollback; includes temporary auto-credit on first wallet use (10 M per token) to unblock real wallets.
- **Settlement Orchestrator:** Queues withdrawals and pool transfers, ready to submit delegated `SEND_ON_BEHALF` operations.
- **Reconciliation Worker:** Designed to poll every 60 s, compare on-chain balances, and auto-pause pools on drift (implementation pending real RPC wiring).

### 3.3 Keeta Network Integration
- Storage accounts follow `keeta:storage:pool:{POOL}:{TOKEN_A}:{TOKEN_B}` naming; pools link to these addresses for transparency.
- Planned RPC/SDK bridge will back `create_pool_storage_account`, `setup_pool_acl`, `query_balance`, `verify_pool_reserves`, and settlement publishing.
- Testnet readiness checklist includes wallet signature prompts, explorer verification, and backend notification endpoints; Node or Rust clients may host the SDK bridge.

## 4. Domain Model & Data Contracts
| Entity | Key Fields | Notes |
| --- | --- | --- |
| `LiquidityPool` | `id`, tokens, reserves, LP token ticker, storage account, pause flag, reconciliation metadata | Tracks on-chain linkage and pending settlement state.
| `Ledger` | `(wallet, token) → (available, total)` | Auto-credits new wallets once; reserve/debit ensures atomicity.
| `SettlementOp` | Variants for withdrawals, pool deposits/withdrawals/swaps | Extended to handle pool flows queued for Keeta submission.
| `CreatePoolRequest` | `wallet_address`, token pair, amounts, fee tier, pool type | Wallet address required across create/add/remove operations.
| `KeetaClient` | RPC URL, HTTP client | Currently hosts placeholders for balance & ACL calls pending SDK integration.

## 5. Critical Flows
### 5.1 Wallet Onboarding
1. User opens `/pools`, connects Keeta wallet (must be unlocked).
2. Frontend captures `publicKey` and live token balances; UI blocks pool actions until a wallet is present.
3. Backend trusts only signed requests tied to that address; future auth ties JWT sessions to wallet challenges.

### 5.2 Order & Trade Lifecycle
1. Trader submits order; backend verifies balances, enqueues in CLOB, matches via price-time priority.
2. Fills debit ledger balances and create settlement items for on-chain reconciliation.
3. Smart router (Phase 4) will inspect order book depth vs. AMM quotes and split orders as needed.

### 5.3 Pool Creation
1. Frontend collects pair, amounts, pool type, fee tier → validates ratio messaging (no arbitrary judgments).
2. Backend reserves wallet balances, creates storage account, configures ACL, instantiates pool, and queues settlement.
3. LP tokens minted (`sqrt(amountA * amountB) − fee`) credited to the initiating wallet; pause flag defaults to active.
4. Auto-credit ensures brand-new wallets succeed; once real balance queries exist this branch is replaced with on-chain checks.

### 5.4 Add & Remove Liquidity
- Add: Reserve funds, verify ACL, queue pool deposit, mint LP tokens when settlement confirmed.
- Remove: Burn LP tokens, queue pool withdrawal, credit user balances post-settlement; UI references real LP balances from wallet tokens.

### 5.5 Settlement & Reconciliation
1. Settlement worker dequeues ops, builds `SEND_ON_BEHALF` transactions, submits to Keeta (pending SDK wiring), and updates ledger totals.
2. Reconciliation worker polls Keeta balances, compares to ledger, pauses pools on drift, and alerts operators.
3. Emergency pause/unpause available manually and via reconciliation guard.

### 5.6 Auto-Credit Safety Net (Temporary)
- On first interaction `ledger.internal_balance` returns `0`; system credits 10 M units per token to allow testing with real wallets.
- Logs highlight temporary status; replacement path will hydrate balances from Keeta once RPC integration lands.

## 6. Security & Risk Controls
- Reserve/debit with rollback to prevent partial failures.
- Minimum liquidity lock to prevent inflation attacks.
- Eight guardrail layers covering ACL scope, reconciliation, emergency pause, Keeta validation, and scoped permissions.
- Users always retain `OWNER`; backend compromise cannot drain funds.
- Console messaging steers users without imposing arbitrary thresholds, preserving transparency.

## 7. Implementation Status (Done)
- Removed demo mode; all pool APIs and modals require real wallet addresses and surface actual wallet balances.
- Established non-custodial frontend builders so the wallet signs/publishes pool creation while backend records state only.
- Delivered constant-product, stable-swap, and weighted AMM math plus CLOB engine with REST/WebSocket APIs.
- Added settlement queue scaffolding, reconciliation design, and pause controls ready for SDK wiring.
- Hardened frontend wallet context (`useMemo` for userClient), three-step pool wizard, and settlement status UI.
- Documented pool custody flows, security layers, and test procedures to align engineering with Keeta requirements.

## 8. Next Build Targets
### 8.1 Immediate (Unblock Testnet)
- Implement real Keeta RPC/SDK bridge (Rust `reqwest` client or Node bridge) powering storage account creation, ACL updates, balance queries, and settlement submission.
- Replace auto-credit path with live balance hydration and adjust ledger initialization accordingly.
- Finalize settlement worker execution for pool deposits/withdrawals and verify 400 ms settlement loop with explorer checks.

### 8.2 Near Term (Stabilize Production Path)
- Complete reconciliation worker with auto-pause, alerting, and drift dashboards.
- Expand frontend to surface transaction hashes, explorer links, and retry guidance.
- Harden API auth (JWT tied to wallet signatures) and rate limiting ahead of public testing.

### 8.3 RFQ Order Book Implementation (New Priority)
- **Phase 1**: Implement RFQ backend infrastructure (order book, API endpoints, validation)
- **Phase 2**: Create RFQ frontend components (order book display, order creation, atomic swaps)
- **Phase 3**: Integrate RFQ with existing trade page (unified interface, mode toggle)
- **Phase 4**: Testing, security audit, and production deployment
- **See**: `RFQ_ORDER_BOOK_IMPLEMENTATION.md` for detailed implementation plan
- **See**: `RFQ_INTEGRATION_SUMMARY.md` for architecture integration details

### 8.4 Phase 4+ Roadmap
- Deliver smart router decision engine combining CLOB depth, AMM quotes, and RFQ orders with optional order splitting.
- Launch advanced analytics, LP dashboards, MM API endpoints, and RFQ market making tools.
- Prepare for security audit, load testing, liquidity incentive programs, and eventual mobile/institutional clients.

## 9. Testing & Operational Playbooks
- **Backend:** `cargo run` for local server; use curl samples for `/api/pools/create`, `/api/pools/add-liquidity`, `/api/pools/remove-liquidity`, `/balances`, and order routes.
- **Frontend:** `bun run dev -- -p 3000`; connect Keeta wallet, execute pool wizard, confirm console logs, and verify explorer data once SDK integration lands.
- **Build & Lint:** `bun run lint`, `bun run build`, and `cargo check/test` after major changes; resolve warnings immediately per repository policy.
- **Incident Response:** Use `pause_pool`/`unpause_pool`, review reconciliation logs, and fallback to OWNER self-withdraw path if automation fails.

## 10. Reference APIs & Resources
- **REST Highlights:** `POST /auth/challenge`, `POST /auth/verify`, `GET /balances`, `POST /orders/place`, `POST /orders/cancel`, `POST /withdrawals/request`, `GET /deposits/address`, `POST /api/pools/{create|add-liquidity|remove-liquidity|swap|quote}`.
- **WebSocket Channels:** `orderbook:{market}`, `trades:{market}`, `orders:{user}`, `balances:{user}`.
- **Key Docs & Tooling:** Keeta storage account and permission docs, SDK guides, settlement explorer URLs, and security checklists maintained alongside this blueprint.

---
This blueprint replaces prior fragmented documentation. Update this file as the single source of truth for Keeta CEX design decisions, implementation status, and next actions.
