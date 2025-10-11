# Keeta DEX/CEX Integration Plan

> **Hybrid Decentralized Exchange Implementation Guide**  
> Combining off-chain order matching with on-chain settlement on Keeta Network

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Phase 1: Backend Infrastructure](#phase-1-backend-infrastructure)
4. [Phase 2: Frontend Integration](#phase-2-frontend-integration)
5. [Phase 3: Smart Account Architecture](#phase-3-smart-account-architecture)
6. [Phase 4: Settlement & Reconciliation](#phase-4-settlement--reconciliation)
7. [Phase 5: API Design](#phase-5-api-design)
8. [Phase 6: Implementation Roadmap](#phase-6-implementation-roadmap)
9. [Phase 7: Database Schema](#phase-7-database-schema)
10. [Phase 8: Security Considerations](#phase-8-security-considerations)
11. [Technology Stack](#technology-stack-summary)
12. [References](#references)

---

## Overview

### Vision
Build a high-performance cryptocurrency exchange that combines the speed of centralized order matching with the security of decentralized custody and settlement, leveraging Keeta Network's unique capabilities.

### Key Features
- ✅ **400ms Settlement Time** - Leveraging Keeta's fast finality
- ✅ **Non-Custodial** - Users retain OWNER control of their funds
- ✅ **Hybrid Architecture** - Off-chain matching, on-chain settlement
- ✅ **Scoped Permissions** - Delegated `SEND_ON_BEHALF` with token-level restrictions
- ✅ **Emergency Exit** - Users can always self-withdraw
- ✅ **10M TPS Ready** - Built on Keeta's high-performance infrastructure

### Design Philosophy
1. **Security First**: Users are always OWNER of their storage accounts
2. **Performance**: Off-chain CLOB for sub-millisecond matching
3. **Transparency**: Continuous on-chain reconciliation
4. **Compliance Ready**: Built-in identity and token governance
5. **LP Support**: Professional market makers with scoped permissions

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Trading UI   │  │ Wallet UI    │  │ LP Dashboard │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↕ REST API / WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Rust + Actix-web)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Auth Service │  │ Order Gateway│  │   CLOB Engine│          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Settlement   │  │ Internal     │  │ Reconciliation│         │
│  │ Orchestrator │  │ Ledger (PG)  │  │ Worker        │         │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↕ Keeta SDK
┌─────────────────────────────────────────────────────────────────┐
│                      Keeta Network (Layer 1)                     │
│  ┌──────────────────────────────────────────────────┐           │
│  │ User Storage Accounts (S_user) - User Owned      │           │
│  │ - OWNER: User's public key                        │           │
│  │ - SEND_ON_BEHALF: Exchange operator (scoped)     │           │
│  └──────────────────────────────────────────────────┘           │
│  ┌──────────────────────────────────────────────────┐           │
│  │ Native Tokens (USDT, USDX, KTA, etc.)            │           │
│  └──────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Backend Infrastructure

See [Keeta CEX Design/keeta_backend_actix_rust.md](./Keeta%20CEX%20Design/keeta_backend_actix_rust.md) for complete implementation.

### Key Components
1. **Authentication Service** - Challenge/response using Keeta keys
2. **Order Gateway** - Order validation and intake
3. **CLOB Engine** - Price-time priority matching
4. **Internal Ledger** - PostgreSQL double-entry bookkeeping
5. **Keeta Integration** - RPC client for on-chain operations
6. **Settlement Orchestrator** - Withdrawal processing
7. **Reconciliation Worker** - Balance verification

---

## Phase 2: Frontend Integration

Enhance existing Next.js application with DEX features.

### Components to Build
- Order placement panel
- Real-time order book display
- User order management
- Trade history
- Deposit/withdrawal modals
- Permission viewer

---

## Phase 3: Smart Account Architecture

### Storage Account Design
- User is OWNER (full control)
- Exchange operator has SEND_ON_BEHALF (scoped to specific tokens)
- Emergency self-withdraw always available

### ACL Structure
```json
{
  "entity": "S_user_ADDRESS",
  "entries": [
    {
      "principal": "USER_PUBLIC_KEY",
      "permissions": ["OWNER"]
    },
    {
      "principal": "EXCHANGE_OPERATOR_KEY",
      "permissions": ["SEND_ON_BEHALF"],
      "target": "TOKEN_ID"
    }
  ]
}
```

---

## Phase 4: Settlement & Reconciliation

### Withdrawal Flow
1. User requests withdrawal
2. Debit internal ledger
3. Queue in settlement orchestrator
4. Build SEND block (SEND_ON_BEHALF)
5. Submit to Keeta (~400ms finality)
6. Update internal ledger

### Reconciliation
- Run every 5 minutes
- Compare on-chain vs internal balances
- Alert on discrepancies
- Auto-correct small drifts

---

## Phase 5: API Design

### REST Endpoints
- `POST /auth/challenge` - Get authentication challenge
- `POST /auth/verify` - Verify signature
- `GET /balances` - Get user balances
- `POST /orders/place` - Place order
- `POST /orders/cancel` - Cancel order
- `POST /withdrawals/request` - Request withdrawal
- `GET /deposits/address` - Get deposit address

### WebSocket
- `orderbook:{market}` - Real-time order book
- `trades:{market}` - Live trade feed
- `orders:{userId}` - User order updates
- `balances:{userId}` - Balance changes

---

## Phase 6: Implementation Roadmap

### 16-Week Plan

**Sprint 1-2**: Backend Foundation  
**Sprint 3-4**: Matching Engine  
**Sprint 5-6**: Settlement & Keeta Integration  
**Sprint 7-8**: Trading UI  
**Sprint 9-10**: Wallet Integration  
**Sprint 11-12**: WebSocket & Real-time  
**Sprint 13-14**: Security & Testing  
**Sprint 15-16**: LP Features  

---

## Phase 7: Database Schema

### Core Tables
- `users` - User accounts
- `balances` - Internal balances (available/total)
- `orders` - Order book
- `fills` - Trade history
- `deposits` - Deposit tracking
- `withdrawals` - Withdrawal queue
- `reconciliations` - Balance audit trail

---

## Phase 8: Security Considerations

### Key Features
✅ Non-custodial (users are OWNER)  
✅ Scoped permissions (per-token)  
✅ Emergency self-withdraw  
✅ Continuous reconciliation  
✅ Hot/cold wallet separation  

### Attack Mitigations
- **Operator Key Compromise**: Scoped permissions + revocation
- **Backend Failure**: Users self-withdraw (OWNER path)
- **Balance Drift**: Auto-reconciliation
- **Double Spend**: Balance reservation + on-chain validation
- **Front-running**: Price-time priority + audit trail

---

## Technology Stack Summary

### Backend
- Rust + Actix-web
- PostgreSQL
- Redis
- Docker

### Frontend
- Next.js 14
- TypeScript
- Tailwind CSS
- Keeta SDK

### Keeta Integration
- Storage accounts
- ACL permissions
- SEND_ON_BEHALF
- 400ms settlement
- 10M TPS capacity

---

## References

### Design Documents
- [Backend Architecture](./Keeta%20CEX%20Design/keeta_backend_actix_rust.md)
- [Internal Book Design](./Keeta%20CEX%20Design/keeta_cex_internal_book_design.md)
- [Client SDK](./Keeta%20CEX%20Design/keeta_client_ts.md)
- [Docker Deployment](./Keeta%20CEX%20Design/keeta_backend_docker_compose.md)

### Keeta Documentation
- Keeta Docs: https://docs.keeta.com/
- Storage Accounts: https://docs.keeta.com/components/accounts/storage-accounts
- Permissions: https://docs.keeta.com/components/accounts/permissions
- Native Tokenization: https://docs.keeta.com/features/native-tokenization

---

**Document Version**: 1.0  
**Last Updated**: October 11, 2024  
**Status**: Ready for Implementation  
**Estimated Timeline**: 16 weeks

---
