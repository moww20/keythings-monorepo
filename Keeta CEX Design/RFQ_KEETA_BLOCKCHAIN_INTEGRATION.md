# RFQ Order System with Keeta Blockchain Integration

## Executive Summary

This document outlines the technical architecture for integrating Request for Quote (RFQ) orders with Keeta Network's blockchain, leveraging storage accounts as escrow mechanisms. The design enables trustless, non-custodial trading where makers lock funds on-chain and takers can verify balances before executing trades. This refined version adds a delivery roadmap focused on phased enablement, atomic settlement, and user experience improvements on the Trade RFQ Page.

**Key Features:**
- **Zero-Custody Architecture**: Backend never controls user funds
- **On-Chain Escrow**: Storage accounts lock maker funds until fill or cancellation
- **Direct Settlement**: Wallet-to-wallet token transfers via Keeta SDK
- **Sub-Second Finality**: ~400ms settlement time on Keeta testnet
- **Trustless Verification**: Takers verify locked funds on-chain before trading
- **Phased Rollout Plan**: Incremental activation across frontend and backend components
- **Security & UX Balance**: Reduced friction through guided wallet flows without compromising authorization rigor

---

## Table of Contents

1. [Feasibility Assessment](#feasibility-assessment)
2. [Phased Implementation Roadmap](#phased-implementation-roadmap)
3. [Trade RFQ Page Integration Plan](#trade-rfq-page-integration-plan)
4. [Architecture Overview](#architecture-overview)
5. [Keeta Network Fundamentals](#keeta-network-fundamentals)
6. [Key Technical Components](#key-technical-components)
7. [Order Lifecycle](#order-lifecycle)
8. [Implementation Details](#implementation-details)
9. [Security Model](#security-model)
10. [Performance Considerations](#performance-considerations)
11. [Testing Strategy](#testing-strategy)

---

## Feasibility Assessment

The RFQ integration with Keeta is **feasible** with the current SDK and storage-account primitives. All critical capabilities—account creation, ACL management, and atomic transfers—are exposed through stable APIs, and the existing RFQ backend already consumes on-chain read models. The remaining challenges are predominantly operational:

- **Wallet Readiness**: The Keeta browser wallet already supports transaction signing, ACL updates, and batched instructions needed for atomic fills. No wallet upgrades are necessary beyond UX copy updates.
- **Backend Constraints**: The indexer can continue to run in read-only mode; required changes are limited to schema extensions and new WebSocket events that broadcast on-chain status transitions.
- **Network Policies**: Storage-account and token permissions are governed by network ACLs. Current throughput and rate limits are adequate for projected RFQ volumes but should be monitored during rollout.
- **User Education**: Makers and takers must understand wallet prompts and escrow mechanics. Incremental rollout allows progressive disclosure and training.

**Conclusion**: With deliberate UX scaffolding and staged release gates, the integration is technically achievable and aligns with platform constraints.

---

## Phased Implementation Roadmap

### Phase 0 – Foundations (1 sprint)
- **Frontend**: Instrument the Trade RFQ Page with feature flags, wallet connection state management, and telemetry to capture drop-off points.
- **Backend**: Extend the RFQ indexer to ingest mock on-chain events and validate schema updates without affecting production data.
- **Shared**: Define audit logging requirements, security reviews, and operational runbooks for wallet-driven flows.

### Phase 1 – Maker Onboarding & Escrow Creation (1–2 sprints)
- **Frontend**: Introduce maker-focused prompts for wallet connection, balance preflight checks, and guided storage-account creation with step indicators.
- **Backend**: Persist order metadata referencing storage-account IDs, index live Keeta storage accounts, and gate maker actions behind beta feature flags.
- **Security**: Enforce address allowlists, transaction simulation, and network verification before enabling signature requests.

### Phase 2 – Taker Atomic Fill & Settlement (1–2 sprints)
- **Frontend**: Allow takers to validate maker escrow balances inline, then initiate fills via a consolidated “Review & Fill” modal that batches signatures.
- **Backend**: Broadcast real-time fill statuses via WebSockets, implement conflict detection for competing fills, and reconcile partial fills automatically.
- **Security**: Monitor for expired or underfunded escrows, trigger alerts, and ensure ACL updates are logged.

### Phase 3 – Optimization & Automation (ongoing)
- **Frontend**: Streamline repeat actions with saved wallet preferences, contextual warnings, and deterministic status badges powered by indexer data.
- **Backend**: Automate stale order cleanup, expose analytics on fill success rates, and harden recovery workflows for failed transactions.
- **Security**: Run chaos tests simulating network delays to confirm atomicity under stress and continuously tune rate limits.

---

## Trade RFQ Page Integration Plan

1. **UI Surface Areas**
   - Maker Panel: Add a “Lock Funds on Keeta” call-to-action with progress indicators for wallet confirmation, escrow creation, and backend verification.
   - Taker Panel: Display on-chain escrow sufficiency, expiry, and status badges adjacent to each quote card.
   - Global Status Bar: Surface wallet connection state, network health, and pending signatures to set expectations and reduce user anxiety.

2. **State Management**
   - Centralize blockchain-derived data in a dedicated store (React Query, Zustand) synchronized with backend WebSocket feeds.
   - Cache account metadata locally to minimize redundant RPC calls while providing manual refresh options for power users.

3. **User Journey Enhancements**
   - Offer contextual education modals explaining signature purpose, escrow safety, and settlement timelines.
   - Provide a “Test Mode” (mock transactions) during early phases so users can practice flows without risking funds.

4. **Observability & Feedback**
   - Track telemetry for wallet connection attempts, signature declines, and escrow creation failures to iterate quickly on UX.
   - Capture qualitative feedback directly within the Trade RFQ Page via optional surveys during beta.

---

## Architecture Overview

### High-Level System Design

```
┌────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                       │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │
│  │ RFQMakerPanel  │  │  RFQTakerPanel   │  │  WalletContext  │ │
│  │  (Publish RFQ) │  │  (Fill Orders)   │  │ (Keeta SDK)     │ │
│  └────────┬───────┘  └────────┬─────────┘  └────────┬────────┘ │
└───────────┼──────────────────┼──────────────────────┼──────────┘
            │                  │                      │
            │ Create Order     │ Fill Order           │ Sign Tx
            ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Keeta Wallet Extension                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  User signs all transactions via wallet                   │  │
│  │  - Create storage account + deposit funds (maker)         │  │
│  │  - Send tokens to maker + receive from storage (taker)    │  │
│  └───────────────────────────────────────────────────────────┘  │
│  │  Source: Maintained in external repo (https://github.com/keythings-labs/keeta-wallet) │  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ Published Blocks
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Keeta Testnet Blockchain                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Storage Account (RFQ Order)                               │  │
│  │  - Address: keeta_storage_abc123...                       │  │
│  │  - Balance: 100 USDT (locked funds)                       │  │
│  │  - Metadata: { pair, price, size, expiry, maker }         │  │
│  │  - Permissions: Maker=OWNER, Taker=SEND_ON_BEHALF (after) │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Settlement Time: ~400ms per transaction                        │
│  Throughput: 10M TPS capacity                                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ Query On-Chain State
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend API (Rust/Actix)                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  KeetaRFQManager (Indexing Only)                          │  │
│  │  - Index storage accounts from Keeta blockchain           │  │
│  │  - Query order balances for UI display                    │  │
│  │  - Track order status (open/filled/cancelled)             │  │
│  │  - NO custody, NO private keys, NO fund control           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Summary

**Order Creation:**
```
User → Wallet Extension → Keeta Blockchain → Backend Indexer → UI Update
(Sign)   (Build Tx)        (Settle ~400ms)    (Index)        (Display)
```

**Order Fill:**
```
User → Wallet Extension → Keeta Blockchain → Backend Verify → UI Update
(Sign)   (Build Swap Tx)   (Atomic Transfer)   (Check State) (Display)
```

---

## Keeta Network Fundamentals

### What is Keeta Network?

Keeta Network is a high-performance Layer-1 blockchain designed for asset transfers with:
- **Settlement Speed**: 400 milliseconds average confirmation time
- **Throughput**: Up to 10 million transactions per second (TPS)
- **Architecture**: Directed Acyclic Graph (DAG) structure where each account has its own blockchain
- **Consensus**: Representative voting system with vote staples for atomic transactions
- **Native Features**: Built-in tokenization, compliance protocols, and cross-chain interoperability

### Account Types on Keeta

Keeta supports multiple account types, each serving specific purposes:

#### 1. Keyed Accounts
- Standard accounts with public/private key pairs
- Can sign transactions and vote on blocks
- User wallets are keyed accounts
- **Use Case**: Maker and taker wallets in RFQ system

#### 2. Storage Accounts
- Generated accounts designed to hold balances
- Support multi-party access control via ACL (Access Control List)
- Can be jointly owned or controlled by multiple accounts
- Cannot sign their own transactions (must be signed by authorized keyed accounts)
- **Use Case**: RFQ order escrow accounts

#### 3. Token Accounts
- Represent fungible or non-fungible assets
- Administrators can modify supply and balances
- Support custom permissions and rules
- **Use Case**: Trading pair tokens (USDT, KTA, etc.)

#### 4. Network Accounts
- One per network, derived from network ID
- Used for network-wide permissions
- Controls who can create tokens or storage accounts
- **Use Case**: Network governance and permissions

### Permissions System

Keeta's permission system is based on **Access Control Lists (ACL)** with the following components:

#### ACL Entry Structure:
```typescript
{
  principal: Account,    // Who is accessing (e.g., taker's wallet)
  entity: Account,       // What is being accessed (e.g., storage account)
  target: Account?,      // Optional: Specific token or resource
  permissions: {
    base: string[],      // Base permissions (network-defined)
    external: number[]   // External permissions (app-defined)
  }
}
```

#### Base Permissions (Relevant to RFQ):

| Permission | Description | RFQ Use Case |
|------------|-------------|--------------|
| **OWNER** | Full control over account, can transfer ownership | Maker owns RFQ storage account |
| **ADMIN** | Can modify account but not transfer ownership | Optional: Co-makers |
| **ACCESS** | Can view/interact with account | Public RFQ orders |
| **STORAGE_DEPOSIT** | Can deposit tokens into storage account | Allow deposits to order escrow |
| **STORAGE_CAN_HOLD** | Storage can hold specific token type | Enable storage to hold USDT/KTA |
| **SEND_ON_BEHALF** | Can send tokens from account on behalf of owner | Taker withdraws from escrow |

#### Permission Hierarchy:

Permissions are evaluated from most specific to least specific:
1. **Exact Match**: Principal + Entity + Target
2. **General Match**: Principal + Entity (any target)
3. **Default Permission**: Entity's default permission
4. **Empty**: No permissions if none match

**Example:**
```typescript
// Maker creates storage account with default permissions
builder.setInfo({
  defaultPermission: new Permissions(['STORAGE_DEPOSIT', 'STORAGE_CAN_HOLD'])
}, { account: storageAccount });

// Anyone can deposit (default permission)
// Only maker can withdraw (OWNER permission auto-granted to creator)
// Taker gets SEND_ON_BEHALF after fill (explicit grant)
```

### Blocks and Operations

#### Block Structure:
```typescript
{
  account: Account,           // Account publishing the block
  network: number,            // Network ID (test/main)
  previous: BlockHash,        // Previous block in account's chain
  signer: Account?,           // Optional: Different signer
  timestamp: number,          // Block creation time
  operations: Operation[],    // List of operations in this block
  signature: Buffer           // Digital signature
}
```

#### Common Operations for RFQ:

1. **Create Identifier** - Generate storage/token account
2. **Set Info** - Set metadata and default permissions
3. **Update Permissions** - Grant/revoke ACL permissions
4. **Send** - Transfer tokens between accounts
5. **Modify Token Supply** - Mint/burn tokens (for token accounts)

### Transaction Building Process

The Keeta SDK uses a **builder pattern** for creating transactions:

#### Step 1: Initialize Builder
```typescript
const client = KeetaNet.UserClient.fromNetwork('test', userAccount);
const builder = client.initBuilder();
```

#### Step 2: Generate Identifiers (if needed)
```typescript
const storageAccount = builder.generateIdentifier(
  KeetaNet.lib.Account.AccountKeyAlgorithm.STORAGE
);
// Returns a "pending" account - address is known but not yet on-chain
```

#### Step 3: Compute Blocks
```typescript
await builder.computeBlocks();
// Finalizes pending identifiers - now you have the actual account reference
const actualAccount = storageAccount.account;
```

#### Step 4: Add Operations
```typescript
// Set metadata
builder.setInfo({
  name: 'RFQ-12345',
  metadata: JSON.stringify({ /* order details */ }),
  defaultPermission: new Permissions(['STORAGE_DEPOSIT'])
}, { account: actualAccount });

// Transfer funds
builder.send(actualAccount, 100_000000n, usdtToken);
```

#### Step 5: Publish to Blockchain
```typescript
await client.publishBuilder(builder);
// User wallet prompts for signature
// Transaction settles on Keeta blockchain in ~400ms
```

### Vote Staples and Consensus

**Vote Staples** are the fundamental unit of transaction finality on Keeta:

- A **vote staple** contains:
  - A set of blocks (in specific order)
  - Votes from representative nodes
  - All blocks in a staple are applied atomically

- **Consensus Process**:
  1. User publishes block to representatives
  2. Representatives vote on block validity
  3. Quorum of votes creates a vote staple
  4. Vote staple is permanently recorded on ledger
  5. All operations in staple execute atomically

- **Atomic Transactions**: All operations in a vote staple succeed or fail together
  - Example: In RFQ fill, taker sending KTA and receiving USDT happens atomically
  - If one operation fails, the entire transaction reverts

### Settlement and Finality

**Settlement Time**: ~400ms average
- **Temporary Votes**: Initial consensus (fast)
- **Permanent Votes**: Final confirmation (trades temporary votes for permanent)

**Finality**: Once a vote staple is confirmed, transactions are irreversible
- No reorgs or rollbacks (DAG structure prevents this)
- Each account has its own blockchain, reducing contention
- Representative voting ensures distributed consensus

---

## Key Technical Components

### 1. UserClient (Keeta SDK)

The primary interface for interacting with Keeta Network from the frontend.

**Initialization:**
```typescript
import * as KeetaNet from '@keetanetwork/keetanet-client';

// Connect to Keeta testnet with user's wallet
const client = KeetaNet.UserClient.fromNetwork('test', userAccount);
```

**Key Methods:**

| Method | Purpose | RFQ Use Case |
|--------|---------|--------------|
| `initBuilder()` | Create transaction builder | Start building RFQ order transaction |
| `publishBuilder()` | Publish transaction to network | Submit order creation to blockchain |
| `computeBuilderBlocks()` | Compute unsigned blocks | Generate blocks without publishing |
| `allBalances()` | Query account token balances | Check maker/taker balances |
| `state({ account })` | Get account state and metadata | Verify storage account details |
| `listACLsByPrincipal()` | List ACLs where user is principal | Find user's storage accounts |
| `listACLsByEntity()` | List ACLs for an entity | Query storage account permissions |
| `history()` | Get transaction history | Track order fills and cancellations |

### 2. BlockBuilder (Transaction Construction)

The builder pattern for incrementally constructing transactions.

**Core Builder Methods:**

```typescript
// Generate identifiers
builder.generateIdentifier(AccountKeyAlgorithm.STORAGE);  // Create storage account
builder.generateIdentifier(AccountKeyAlgorithm.TOKEN);    // Create token account

// Compute pending identifiers
await builder.computeBlocks();  // Finalize account addresses

// Set account information
builder.setInfo({
  name: string,                    // Human-readable name
  description: string,             // Account description
  metadata: string,                // JSON metadata (order details)
  defaultPermission: Permissions   // Default access rules
}, { account: Account });

// Transfer tokens
builder.send(
  to: Account,                     // Recipient
  amount: bigint,                  // Amount (with decimals)
  token: Account,                  // Token type
  data?: Buffer,                   // Optional data
  options?: {
    account: Account,              // Send FROM this account (for storage)
    signer: Account                // Different signer
  }
);

// Update permissions
builder.updatePermissions(
  principal: Account,              // Who gets permissions
  permissions: Permissions,        // What permissions
  target?: Account,                // Optional: For specific token
  adjustMethod?: AdjustMethod,     // ADD or SUBTRACT
  options?: { account: Account }   // Target entity
);

// Publish all operations
await builder.publish();
```

**RFQ Order Creation Example:**
```typescript
const builder = client.initBuilder();

// Step 1: Generate storage account identifier
const pendingStorage = builder.generateIdentifier(
  KeetaNet.lib.Account.AccountKeyAlgorithm.STORAGE
);

// Step 2: Compute to get actual account
await builder.computeBlocks();
const storageAccount = pendingStorage.account;

// Step 3: Set order metadata
builder.setInfo({
  name: `RFQ-${Date.now()}`,
  description: 'Sell 100 USDT @ 200 KTA/USDT',
  metadata: JSON.stringify({
    orderType: 'rfq',
    pair: 'KTA/USDT',
    side: 'sell',
    price: 200.0,
    size: 100.0,
    minFill: 10.0,
    expiry: '2025-12-31T23:59:59Z',
    maker: maker PublicKey,
    createdAt: new Date().toISOString()
  }),
  defaultPermission: new KeetaNet.lib.Permissions([
    'STORAGE_DEPOSIT',      // Anyone can deposit
    'STORAGE_CAN_HOLD'      // Can hold tokens
  ])
}, { account: storageAccount });

// Step 4: Transfer USDT to storage (locks funds)
const usdtToken = KeetaNet.lib.Account.fromPublicKeyString(USDT_ADDRESS);
const amount = 100n * 1000000n;  // 100 USDT (6 decimals)
builder.send(storageAccount, amount, usdtToken);

// Step 5: Publish - user signs in wallet
await client.publishBuilder(builder);

// Result: Storage account created with 100 USDT locked
// Address: storageAccount.publicKeyString.toString()
```

### 3. Account Class

Represents accounts (both keyed and generated) on Keeta Network.

**Creation Methods:**
```typescript
// From seed (deterministic key generation)
const account = KeetaNet.lib.Account.fromSeed(seedString, index);

// From public key string (for referencing existing accounts)
const account = KeetaNet.lib.Account.fromPublicKeyString('keeta_1abc...');

// Generate random seed
const seed = KeetaNet.lib.Account.generateRandomSeed({ asString: true });
```

**Key Properties:**
```typescript
account.publicKeyString.toString()  // Get Keeta address
account.sign(data)                  // Sign data with private key
account.isStorage()                 // Check if storage account
account.isToken()                   // Check if token account
```

**RFQ Usage:**
```typescript
// Maker and taker accounts (from wallet)
const makerAccount = userClient.account;

// Token accounts (from environment config)
const usdtToken = KeetaNet.lib.Account.fromPublicKeyString(
  process.env.NEXT_PUBLIC_USDT_TOKEN_ADDRESS
);

// Storage account (generated during order creation)
const storageAccount = builder.generateIdentifier(...).account;
```

### 4. Permissions Class

Manages access control permissions for accounts.

**Creating Permissions:**
```typescript
// Base permissions
const readPermissions = new KeetaNet.lib.Permissions(['ACCESS']);

const depositPermissions = new KeetaNet.lib.Permissions([
  'STORAGE_DEPOSIT',
  'STORAGE_CAN_HOLD'
]);

const adminPermissions = new KeetaNet.lib.Permissions([
  'ADMIN',
  'UPDATE_INFO'
]);

// External permissions (app-defined)
const externalPerms = new KeetaNet.lib.Permissions([], [1, 5, 12]);
```

**RFQ Permission Patterns:**

**Maker-Owned Storage (Order Creation):**
```typescript
// Default permissions for RFQ storage account
builder.setInfo({
  defaultPermission: new Permissions([
    'STORAGE_DEPOSIT',      // Anyone can deposit tokens
    'STORAGE_CAN_HOLD'      // Storage can hold any token
  ])
}, { account: storageAccount });

// Maker automatically gets OWNER permission (creator)
// Maker can withdraw funds, cancel order, modify metadata
```

**Taker Fill Permission (Optional):**
```typescript
// Grant taker permission to withdraw from storage
builder.updatePermissions(
  takerAccount,                            // Taker's wallet
  new Permissions(['SEND_ON_BEHALF']),     // Can send on behalf
  undefined,                               // No specific target
  KeetaNet.lib.Block.AdjustMethod.ADD,     // Add permission
  { account: storageAccount }              // To storage account
);
```

### 5. Storage Account Manager (Frontend Utility)

A utility class for managing RFQ storage accounts in the frontend.

**Purpose:**
- Simplify storage account creation
- Handle permission setup
- Manage fund deposits and withdrawals
- Query storage account state

**Implementation:**
```typescript
// src/app/lib/storage-account-manager.ts

export class StorageAccountManager {
  constructor(private userClient: KeetaNet.UserClient) {}

  /**
   * Create RFQ storage account with order details
   */
  async createRFQStorage(orderDetails: RFQOrderDetails): Promise<string> {
    const builder = this.userClient.initBuilder();
    
    // Generate storage account
    const storageAccount = builder.generateIdentifier(
      KeetaNet.lib.Account.AccountKeyAlgorithm.STORAGE
    );
    
    await builder.computeBlocks();
    const account = storageAccount.account;
    
    // Set metadata with order details
    builder.setInfo({
      name: `RFQ-${Date.now()}`,
      description: `${orderDetails.side} ${orderDetails.size} ${orderDetails.pair}`,
      metadata: JSON.stringify(orderDetails),
      defaultPermission: new KeetaNet.lib.Permissions([
        'STORAGE_DEPOSIT',
        'STORAGE_CAN_HOLD'
      ])
    }, { account });
    
    // Transfer funds to lock
    const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(
      orderDetails.tokenAddress
    );
    const amount = this.toBaseUnits(orderDetails.size, orderDetails.decimals);
    
    builder.send(account, amount, tokenAccount);
    
    // Publish transaction
    await this.userClient.publishBuilder(builder);
    
    return account.publicKeyString.toString();
  }

  /**
   * Withdraw funds from storage (cancel order)
   */
  async withdrawFromStorage(
    storageAddress: string,
    tokenAddress: string,
    amount: number,
    decimals: number
  ): Promise<void> {
    const builder = this.userClient.initBuilder();
    
    const storageAccount = KeetaNet.lib.Account.fromPublicKeyString(storageAddress);
    const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(tokenAddress);
    
    // Withdraw to maker's wallet
    builder.send(
      this.userClient.account,  // To maker
      this.toBaseUnits(amount, decimals),
      tokenAccount,
      undefined,
      { account: storageAccount }  // From storage
    );
    
    await this.userClient.publishBuilder(builder);
  }

  /**
   * Query storage account balance
   */
  async getStorageBalance(storageAddress: string): Promise<Map<string, bigint>> {
    const storageAccount = KeetaNet.lib.Account.fromPublicKeyString(storageAddress);
    const client = KeetaNet.UserClient.fromNetwork(
      'test',
      null,
      { account: storageAccount }
    );
    
    return await client.allBalances();
  }

  /**
   * Get storage account metadata
   */
  async getStorageMetadata(storageAddress: string): Promise<any> {
    const storageAccount = KeetaNet.lib.Account.fromPublicKeyString(storageAddress);
    const client = KeetaNet.UserClient.fromNetwork(
      'test',
      null,
      { account: storageAccount }
    );
    
    const state = await client.state({ account: storageAccount });
    return JSON.parse(state.info.metadata || '{}');
  }

  private toBaseUnits(amount: number, decimals: number): bigint {
    return BigInt(Math.floor(amount * Math.pow(10, decimals)));
  }
}
```

### 6. Backend RFQ Manager (Rust)

The backend component for indexing on-chain RFQ orders.

**Purpose:**
- Index storage accounts from Keeta blockchain
- Cache order data for fast querying
- Verify order fills and cancellations
- **NEVER** control funds or sign transactions

**Implementation:**
```rust
// keythings-dapp-engine/src/keeta_rfq.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use log::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeetaRFQOrder {
    pub order_id: String,
    pub storage_account: String,      // Keeta storage account address
    pub maker_public_key: String,     // Maker's wallet address
    pub pair: String,                 // Trading pair
    pub side: String,                 // buy or sell
    pub price: f64,                   // Price in quote currency
    pub size: f64,                    // Size in base currency
    pub min_fill: Option<f64>,        // Minimum fill amount
    pub expiry: String,               // ISO 8601 timestamp
    pub status: String,               // open, filled, cancelled
    pub created_at: String,           // ISO 8601 timestamp
    pub updated_at: String,           // ISO 8601 timestamp
}

pub struct KeetaRFQManager {
    orders: HashMap<String, KeetaRFQOrder>,
    // Future: Add Keeta SDK client for querying blockchain
}

impl KeetaRFQManager {
    pub fn new() -> Self {
        Self {
            orders: HashMap::new(),
        }
    }

    /// Index an RFQ order from Keeta blockchain
    pub async fn index_rfq_order(
        &mut self,
        storage_account: &str,
        order_data: RFQOrderData
    ) -> Result<KeetaRFQOrder, String> {
        info!("[KeetaRFQ] Indexing order from storage: {}", storage_account);
        
        // TODO: Query Keeta blockchain to verify:
        // 1. Storage account exists
        // 2. Storage account has correct metadata
        // 3. Storage account has locked funds
        
        let keeta_order = KeetaRFQOrder {
            order_id: order_data.id.clone(),
            storage_account: storage_account.to_string(),
            maker_public_key: order_data.maker_pubkey.clone(),
            pair: order_data.pair.clone(),
            side: order_data.side.clone(),
            price: order_data.price,
            size: order_data.size,
            min_fill: order_data.min_fill,
            expiry: order_data.expiry.clone(),
            status: "open".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };
        
        self.orders.insert(order_data.id.clone(), keeta_order.clone());
        
        info!("[KeetaRFQ] Order {} indexed successfully", order_data.id);
        Ok(keeta_order)
    }

    /// Verify order fill on blockchain
    pub async fn verify_order_fill(&self, order_id: &str) -> Result<bool, String> {
        info!("[KeetaRFQ] Verifying fill for order {}", order_id);
        
        // TODO: Query Keeta blockchain to check:
        // 1. Storage account balance is empty (funds transferred)
        // 2. Maker received taker's tokens
        // 3. Transaction is confirmed in a vote staple
        
        Ok(true)
    }

    /// Verify order cancellation on blockchain
    pub async fn verify_order_cancel(&self, order_id: &str) -> Result<bool, String> {
        info!("[KeetaRFQ] Verifying cancellation for order {}", order_id);
        
        // TODO: Query Keeta blockchain to check:
        // 1. Storage account balance is empty (funds returned to maker)
        // 2. Storage metadata updated with cancelled status
        
        Ok(true)
    }

    /// Get all open orders
    pub fn get_open_orders(&self) -> Vec<KeetaRFQOrder> {
        self.orders
            .values()
            .filter(|o| o.status == "open")
            .cloned()
            .collect()
    }
}
```

---

## Order Lifecycle

### 1. Order Creation (Maker)

**Frontend Flow:**
```typescript
// src/app/contexts/RFQContext.tsx

const createQuote = async (submission: RFQQuoteSubmission) => {
  // 1. Get wallet context
  const { createRFQStorageAccount } = useWallet();
  
  // 2. Create storage account on Keeta blockchain
  const storageAccountAddress = await createRFQStorageAccount({
    pair: submission.pair,
    side: submission.side,
    price: parseFloat(submission.price),
    size: parseFloat(submission.size),
    minFill: submission.minFill,
    expiry: calculateExpiry(submission.expiryPreset),
    tokenAddress: getTokenAddress(submission.pair, submission.side),
    decimals: getTokenDecimals(submission.pair, submission.side)
  });
  
  // 3. Notify backend to index the order
  const newOrder: RFQOrder = {
    id: '',  // Backend generates
    pair: submission.pair,
    side: submission.side,
    price: parseFloat(submission.price),
    size: parseFloat(submission.size),
    minFill: submission.minFill,
    expiry: calculateExpiry(submission.expiryPreset),
    maker: submission.maker,
    unsignedBlock: storageAccountAddress,  // Storage account address
    makerSignature: 'on-chain',  // Indicates on-chain transaction
    allowlisted: !!submission.allowlistLabel,
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // 4. Send to backend for indexing
  const createdOrder = await createRfqOrder(newOrder);
  
  // 5. Update local state
  setOrders(prev => [createdOrder, ...prev]);
  
  return createdOrder;
};
```

**On-Chain Actions:**
1. ✅ Storage account created with unique address
2. ✅ Metadata set with order details (pair, price, size, expiry)
3. ✅ Default permissions set (STORAGE_DEPOSIT, STORAGE_CAN_HOLD)
4. ✅ Maker funds transferred to storage account (100 USDT locked)
5. ✅ Maker automatically granted OWNER permission
6. ✅ Transaction settles in ~400ms on Keeta testnet

**Result:**
- Storage account address: `keeta_storage_abc123...`
- On-chain balance: 100 USDT (verifiable)
- Maker can cancel anytime (OWNER permission)
- Order visible to all traders

### 2. Order Discovery (Taker)

**Frontend Flow:**
```typescript
// src/app/components/rfq/RFQOrderBook.tsx

const discoverOrders = async () => {
  // 1. Fetch orders from backend
  const orders = await fetchRfqOrders();
  
  // 2. For each order, verify on-chain
  const verifiedOrders = await Promise.all(
    orders.map(async (order) => {
      const storageAccount = order.unsignedBlock;  // Storage account address
      
      // Query Keeta blockchain
      const balance = await client.allBalances({ 
        account: KeetaNet.lib.Account.fromPublicKeyString(storageAccount)
      });
      
      const metadata = await client.state({
        account: KeetaNet.lib.Account.fromPublicKeyString(storageAccount)
      });
      
      return {
        ...order,
        verifiedBalance: balance.get(order.token),  // On-chain balance
        verifiedMetadata: JSON.parse(metadata.info.metadata)
      };
    })
  );
  
  setOrders(verifiedOrders);
};
```

**Verification Steps:**
1. ✅ Query storage account balance (verify funds locked)
2. ✅ Read storage account metadata (verify order details)
3. ✅ Check maker's OWNER permission (verify control)
4. ✅ Validate expiry time (check if still valid)
5. ✅ Display verified orders in UI

**Taker Benefits:**
- Can verify maker has funds before filling
- No trust required (all on-chain)
- Can check order history on Keeta explorer
- Clear pricing and size information

### 3. Order Fill (Taker)

**Frontend Flow:**
```typescript
// src/app/contexts/WalletContext.tsx

const fillRFQOrder = async (
  orderId: string,
  storageAccount: string,
  makerAccount: string,
  fillAmount: number,
  orderDetails: RFQOrder
) => {
  const builder = userClient.initBuilder();
  
  const storageAcct = KeetaNet.lib.Account.fromPublicKeyString(storageAccount);
  const makerAcct = KeetaNet.lib.Account.fromPublicKeyString(makerAccount);
  
  const takerToken = getT akerToken(orderDetails);  // KTA
  const makerToken = getMakerToken(orderDetails);  // USDT
  
  // Calculate amounts
  const takerAmount = fillAmount;  // 0.5 KTA
  const makerAmount = fillAmount * orderDetails.price;  // 100 USDT
  
  // Operation 1: Taker sends KTA to maker
  builder.send(
    makerAcct,
    BigInt(Math.floor(takerAmount * 1e6)),
    KeetaNet.lib.Account.fromPublicKeyString(takerToken)
  );
  
  // Operation 2: Taker receives USDT from storage
  builder.send(
    userClient.account,  // Taker's wallet
    BigInt(Math.floor(makerAmount * 1e6)),
    KeetaNet.lib.Account.fromPublicKeyString(makerToken),
    undefined,
    { account: storageAcct }  // Send FROM storage account
  );
  
  // Publish transaction - user signs in wallet
  await userClient.publishBuilder(builder);
  
  // Both transfers execute atomically in a vote staple
  // Settlement time: ~400ms
};
```

**On-Chain Actions:**
1. ✅ Taker sends 0.5 KTA to maker's wallet
2. ✅ Storage account sends 100 USDT to taker's wallet
3. ✅ Both operations in same vote staple (atomic)
4. ✅ Either both succeed or both fail
5. ✅ Transaction settles in ~400ms

**Permissions:**
- Taker has STORAGE_DEPOSIT permission (default)
- Taker can withdraw because they're sending TO the storage owner's designated recipient
- OR: Maker pre-grants SEND_ON_BEHALF permission to taker

**Atomic Settlement Safeguards:**
- **Batched Operations**: Maker funding, ACL delegation, and taker settlement are bundled into a single builder flow so no intermediate state leaks on-chain.
- **Pre-Fill Simulation**: Frontend requests backend-assisted dry runs to catch insufficient balances or permission gaps before the wallet prompts the user.
- **Optimistic UI with Rollback**: UI surfaces a pending state with timeout-based rollback and user messaging if chain confirmation is delayed or rejected.
- **Indexer Reconciliation**: Backend cross-checks on-chain balances with cached order state after every fill and raises alerts for discrepancies.

### 4. Order Cancellation (Maker)

**Frontend Flow:**
```typescript
// src/app/contexts/WalletContext.tsx

const cancelRFQOrder = async (
  storageAccount: string,
  tokenAddress: string,
  amount: number,
  decimals: number
) => {
  const builder = userClient.initBuilder();
  
  const storageAcct = KeetaNet.lib.Account.fromPublicKeyString(storageAccount);
  const tokenAcct = KeetaNet.lib.Account.fromPublicKeyString(tokenAddress);
  
  // Withdraw funds from storage back to maker
  builder.send(
    userClient.account,  // Maker's wallet
    BigInt(Math.floor(amount * Math.pow(10, decimals))),
    tokenAcct,
    undefined,
    { account: storageAcct }  // Send FROM storage account
  );
  
  // Optional: Update metadata to mark as cancelled
  builder.setInfo({
    metadata: JSON.stringify({ 
      ...existingMetadata,
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    })
  }, { account: storageAcct });
  
  // Publish transaction
  await userClient.publishBuilder(builder);
};
```

**On-Chain Actions:**
1. ✅ Maker withdraws 100 USDT from storage to wallet
2. ✅ Storage account balance becomes 0
3. ✅ Metadata updated to status: 'cancelled'
4. ✅ Transaction settles in ~400ms
5. ✅ Maker can reuse funds for new orders

**Permissions:**
- Maker has OWNER permission on storage account
- Can withdraw anytime
- Can update metadata
- Can even transfer ownership if desired

---

## Implementation Details

### Frontend Architecture

#### Canonical Token Address Registry

**Problem:** Early prototypes hard-coded `PLACEHOLDER_BASE`, `PLACEHOLDER_KTA`, and other sentinel strings in the RFQ flow. Those values leaked into both the UI and the backend, making it impossible to rely on the actual on-chain token addresses now published by Keeta.

**Solution:** Introduce a dedicated registry that resolves token metadata by symbol, pair, or address. The registry is hydrated from an authenticated backend endpoint and cached in the frontend. All RFQ builders request addresses from this registry instead of embedding placeholders.

**Key Behaviors:**

- Fetch canonical token metadata (`address`, `decimals`, `symbol`, `displayName`) from `GET /rfq/token-registry` on app bootstrap.
- Expose a `TokenRegistryContext` with helpers such as `resolveBySymbol('USDT')` or `resolvePair({ base: 'KTA', quote: 'USDT' })`.
- Throw explicit errors if a requested token is missing—this bubbles up to the UI so we never silently fall back to placeholder strings.
- Invalidate and refresh the registry when the backend signals new listings (WebSocket `token_registry.updated`).

**Example Implementation:**

```typescript
// src/app/contexts/TokenRegistryContext.tsx

export interface TokenMetadata {
  symbol: string;
  address: string;
  decimals: number;
  displayName: string;
}

const TokenRegistryContext = createContext<TokenRegistryValue | null>(null);

export function TokenRegistryProvider({ children }: PropsWithChildren) {
  const { data, error } = useQuery(['token-registry'], fetchTokenRegistry, {
    staleTime: 5 * 60 * 1000,
  });

  const value = useMemo(() => {
    if (!data) {
      return emptyRegistry();
    }

    return buildLookupTables(data.tokens);
  }, [data]);

  if (error) {
    throw new Error('Failed to load token registry');
  }

  return (
    <TokenRegistryContext.Provider value={value}>
      {children}
    </TokenRegistryContext.Provider>
  );
}

export function useTokenRegistry() {
  const context = useContext(TokenRegistryContext);
  if (!context) {
    throw new Error('useTokenRegistry must be used within TokenRegistryProvider');
  }
  return context;
}
```

This context becomes the single source of truth for token addresses throughout the RFQ experience.

#### WalletContext Enhancement

**File:** `src/app/contexts/WalletContext.tsx`

**New Methods:**
```typescript
interface WalletContextValue {
  // Existing fields...
  
  // RFQ blockchain methods
  createRFQStorageAccount: (orderDetails: RFQOrderDetails) => Promise<string>;
  fillRFQOrder: (fillDetails: RFQFillDetails) => Promise<void>;
  cancelRFQOrder: (cancelDetails: RFQCancelDetails) => Promise<void>;
  verifyStorageAccount: (storageAddress: string) => Promise<StorageAccountState>;
}
```

**Implementation:**
```typescript
const { resolvePair } = useTokenRegistry();

const createRFQStorageAccount = useCallback(async (submission: RFQQuoteSubmission) => {
  if (!userClient || !publicKey) {
    throw new Error('Wallet not connected');
  }

  const tokenMeta = resolvePair({
    baseSymbol: submission.baseSymbol,
    quoteSymbol: submission.quoteSymbol,
    side: submission.side,
  });

  const storageManager = new StorageAccountManager(userClient);
  const storageAddress = await storageManager.createRFQStorage({
    pair: submission.pair,
    side: submission.side,
    price: submission.price,
    size: submission.size,
    minFill: submission.minFill,
    expiry: submission.expiry,
    tokenAddress: tokenMeta.lockedToken.address,
    decimals: tokenMeta.lockedToken.decimals,
  });

  return storageAddress;
}, [userClient, publicKey, resolvePair]);
```

#### RFQContext Updates

**File:** `src/app/contexts/RFQContext.tsx`

**Updated createQuote:**
```typescript
const createQuote = useCallback(async (submission: RFQQuoteSubmission) => {
  const { createRFQStorageAccount } = useWallet();
  
  try {
    // Create storage account on Keeta blockchain
    const storageAccountAddress = await createRFQStorageAccount({
      pair: submission.pair,
      side: submission.side,
      price: parseFloat(submission.price),
      size: parseFloat(submission.size),
      minFill: submission.minFill ? parseFloat(submission.minFill) : undefined,
      expiry: new Date(Date.now() + getExpiryMs(submission.expiryPreset)).toISOString(),
      tokenAddress: getTokenAddress(submission.pair, submission.side),
      decimals: getTokenDecimals(submission.pair, submission.side)
    });
    
    // Create order object with storage account reference
    const newOrder: RFQOrder = {
      id: '',  // Backend generates
      pair: submission.pair,
      side: submission.side,
      price: parseFloat(submission.price),
      size: parseFloat(submission.size),
      minFill: submission.minFill ? parseFloat(submission.minFill) : undefined,
      expiry: new Date(Date.now() + getExpiryMs(submission.expiryPreset)).toISOString(),
      maker: submission.maker,
      unsignedBlock: storageAccountAddress,  // Storage account address
      makerSignature: 'on-chain',  // Indicates published on-chain
      allowlisted: !!submission.allowlistLabel,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Notify backend to index the order
    const createdOrder = await createRfqOrder(newOrder);
    setOrders(prev => [createdOrder, ...prev]);
    
    return createdOrder;
  } catch (error) {
    console.error('[RFQ] Order creation failed:', error);
    throw error;
  }
}, [createRFQStorageAccount]);
```

#### Token Utilities

**File:** `src/app/lib/token-utils.ts`

**Token Address Mapping:**
```typescript
const TOKEN_ADDRESSES = {
  'KTA': process.env.NEXT_PUBLIC_KTA_TOKEN_ADDRESS || 'keeta_base_token',
  'USDT': process.env.NEXT_PUBLIC_USDT_TOKEN_ADDRESS || '',
  'BASE': process.env.NEXT_PUBLIC_BASE_TOKEN_ADDRESS || '',
};

const TOKEN_DECIMALS = {
  'KTA': 6,
  'USDT': 6,
  'BASE': 6,
};

export function getTokenAddress(pair: string, side: 'buy' | 'sell'): string {
  const [base, quote] = pair.split('/');
  // If maker is selling, they're locking quote currency (USDT)
  // If maker is buying, they're locking base currency (KTA)
  return side === 'sell' ? TOKEN_ADDRESSES[quote] : TOKEN_ADDRESSES[base];
}

export function getTokenDecimals(pair: string, side: 'buy' | 'sell'): number {
  const [base, quote] = pair.split('/');
  return side === 'sell' ? TOKEN_DECIMALS[quote] : TOKEN_DECIMALS[base];
}

export function getMakerTokenAddress(order: RFQOrder): string {
  const [base, quote] = order.pair.split('/');
  return order.side === 'sell' ? TOKEN_ADDRESSES[quote] : TOKEN_ADDRESSES[base];
}

export function getTakerTokenAddress(order: RFQOrder): string {
  const [base, quote] = order.pair.split('/');
  return order.side === 'sell' ? TOKEN_ADDRESSES[base] : TOKEN_ADDRESSES[quote];
}

export function toBaseUnits(amount: number, decimals: number): bigint {
  return BigInt(Math.floor(amount * Math.pow(10, decimals)));
}

export function fromBaseUnits(amount: bigint, decimals: number): number {
  return Number(amount) / Math.pow(10, decimals);
}
```

### Backend Architecture

The backend continues to operate as an orchestration layer—**it never signs, never submits blocks, and it no longer exposes or depends on `EXCHANGE_OPERATOR_PUBKEY`**. All signature authority remains with end-user wallets or automated market-maker bots running client-side code. The backend’s responsibilities are limited to cataloguing orders, enriching them with off-chain data, and exposing canonical token metadata.

#### RFQ API Endpoints

**File:** `keythings-dapp-engine/src/rfq_api.rs`

**Updated create_order Endpoint:**
```rust
pub async fn create_order(payload: web::Json<RFQOrder>) -> impl Responder {
    let order = payload.into_inner();
    let order_id = format!("order-{}", chrono::Utc::now().timestamp_millis());
    
    let mut new_order = order;
    new_order.id = order_id.clone();
    new_order.created_at = chrono::Utc::now().to_rfc3339();
    new_order.updated_at = chrono::Utc::now().to_rfc3339();
    
    // Extract storage account address from unsigned_block field
    let storage_account = new_order.unsigned_block.clone();

    // Index the on-chain order
    let mut keeta_manager = KEETA_RFQ_MANAGER.lock().unwrap();
    match keeta_manager.index_rfq_order(&storage_account, new_order.clone()).await {
        Ok(keeta_order) => {
            log::info!(
                "[RFQ] Indexed order {} from Keeta storage account {}", 
                order_id,
                storage_account
            );
            
            // Store in local cache for fast queries
            let mut orders = RFQ_ORDERS.lock().unwrap();
            orders.insert(order_id.clone(), new_order.clone());
            
            HttpResponse::Created().json(new_order)
        }
        Err(e) => {
            log::error!("[RFQ] Failed to index order: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to index Keeta order: {}", e)
            }))
        }
    }
}
```

**Updated fill_order Endpoint:**
```rust
pub async fn fill_order(
    order_id: web::Path<String>,
    payload: web::Json<FillRequest>
) -> impl Responder {
    let fill = payload.into_inner();
    
    let mut orders = RFQ_ORDERS.lock().unwrap();
    let order = match orders.get_mut(&order_id.into_inner()) {
        Some(o) => o,
        None => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Order not found"
            }));
        }
    };
    
    // Verify fill on Keeta blockchain
    let keeta_manager = KEETA_RFQ_MANAGER.lock().unwrap();
    match keeta_manager.verify_order_fill(&order.id).await {
        Ok(true) => {
            order.status = "filled".to_string();
            order.taker_fill_amount = Some(fill.taker_amount);
            order.taker_address = fill.taker_address.clone();
            order.updated_at = chrono::Utc::now().to_rfc3339();
            
            log::info!("[RFQ] Order {} filled by {}", order.id, fill.taker_address.unwrap_or_default());
            
            HttpResponse::Ok().json(order.clone())
        }
        Ok(false) => {
            HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Fill not verified on blockchain"
            }))
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Verification failed: {}", e)
            }))
        }
    }
}
```

### Environment Configuration

**File:** `.env.local`

```env
# RFQ API Configuration
NEXT_PUBLIC_RFQ_API_URL=http://localhost:8080

# Keeta Network Configuration
NEXT_PUBLIC_KEETA_NETWORK=test
NEXT_PUBLIC_KEETA_RPC_URL=https://rpc.test.keeta.network

# Token Registry Endpoint (canonical mapping of symbol → address)
NEXT_PUBLIC_TOKEN_REGISTRY_URL=https://api.dev.keythings.com/rfq/token-registry

# Wallet Extension Configuration
NEXT_PUBLIC_WALLET_EXTENSION_ID=keeta-wallet-extension
```

**Sample Registry Response:**

```json
{
  "tokens": [
    {
      "symbol": "KTA",
      "address": "keeta_14d8f...",
      "decimals": 6,
      "displayName": "Keeta Token"
    },
    {
      "symbol": "USDT",
      "address": "keeta_27b1c...",
      "decimals": 6,
      "displayName": "Tether USD"
    }
  ],
  "pairs": [
    {
      "pair": "KTA/USDT",
      "base": "KTA",
      "quote": "USDT",
      "makerLocks": "USDT"
    }
  ]
}
```

---

## Security Model

### Zero-Custody Architecture

**Principle:** The backend NEVER holds user funds or private keys.

**Implementation:**
1. ✅ Users sign all transactions via Keeta Wallet Extension
2. ✅ Backend only indexes on-chain data and distributes registry metadata
3. ✅ Storage accounts owned by makers (OWNER permission)
4. ✅ Backend cannot move funds (no private keys)
5. ✅ All fund movements visible on Keeta blockchain

**Deprecation Notice:** Historical references to an `EXCHANGE_OPERATOR_PUBKEY` have been eliminated. The orchestration service does not possess or require an operator account—doing so would break the zero-custody guarantee and create unnecessary compliance obligations.

**Comparison with Custodial Exchanges:**

| Aspect | KeyThings RFQ (Non-Custodial) | Traditional CEX (Custodial) |
|--------|-------------------------------|----------------------------|
| **Fund Control** | User (via OWNER permission) | Exchange (holds private keys) |
| **Private Keys** | User's wallet only | Exchange database |
| **Transaction Signing** | User signs every transaction | Exchange signs internally |
| **Withdrawal** | Instant (maker cancels order) | Delayed (exchange approval) |
| **Hack Risk** | Individual wallet only | Entire exchange at risk |
| **Regulatory** | No custody = less regulation | Full custody = heavy regulation |

### Permission-Based Security

**Storage Account Permissions:**

```
Maker (Creator):
├─ OWNER → Full control
│   ├─ Can withdraw funds (cancel order)
│   ├─ Can update metadata
│   └─ Can transfer ownership

Taker (After Permission Grant):
├─ SEND_ON_BEHALF → Limited control
│   ├─ Can send tokens FROM storage
│   ├─ Cannot modify metadata
│   └─ Cannot transfer ownership

Public (Default Permissions):
├─ STORAGE_DEPOSIT → Can deposit only
├─ ACCESS → Can view account
└─ STORAGE_CAN_HOLD → Storage can hold tokens
```

**Permission Validation:**

Keeta network validates permissions on every operation:
1. User attempts operation (e.g., send tokens from storage)
2. Network checks ACL for user + storage account + token
3. If permission exists → operation succeeds
4. If permission missing → operation fails, transaction reverts

**Attack Scenarios and Mitigations:**

| Attack | Mitigation |
|--------|-----------|
| **Backend Hacked** | Backend has no private keys, cannot move funds |
| **Taker Steals Funds** | Taker has no permissions until fill is authorized |
| **Maker Front-Runs Taker** | Maker can cancel, but taker verifies balance first |
| **Double-Spend** | Keeta consensus prevents (vote staples are atomic) |
| **Replay Attack** | Each block has unique previous hash (prevents replay) |

### Balancing Security and User Friction

- **Progressive Permission Requests**: Only request elevated permissions (e.g., SEND_ON_BEHALF) at the moment they are required, ensuring users understand each consent step.
- **Prefetched Transaction Payloads**: Prepare transactions server-side so wallet prompts appear with clear, human-readable summaries and minimal signing steps.
- **Session Awareness**: Cache recent wallet connections to skip redundant approvals while still requiring explicit signatures for fund movements.
- **In-Context Education**: Provide inline explanations and tooltips that reinforce why security steps (like verifying network or reviewing ACL changes) protect funds.

### Transaction Atomicity

**Vote Staples Ensure Atomic Execution:**

**RFQ Fill Transaction:**
```
Vote Staple {
  blocks: [
    Block 1: Taker sends 0.5 KTA to maker,
    Block 2: Storage sends 100 USDT to taker
  ]
}

Result: Either BOTH succeed or BOTH fail
```

**Why This Matters:**
- Taker cannot lose KTA without receiving USDT
- Maker cannot receive KTA without sending USDT
- No partial fills (all-or-nothing)
- No race conditions or timing attacks

### On-Chain Verification

**Takers Can Verify Everything:**

```typescript
// Verify maker has locked funds
const balance = await client.allBalances({
  account: KeetaNet.lib.Account.fromPublicKeyString(storageAccount)
});

if (balance.get(usdtToken) < orderSize) {
  throw new Error('Insufficient funds locked');
}

// Verify order metadata
const state = await client.state({
  account: KeetaNet.lib.Account.fromPublicKeyString(storageAccount)
});

const metadata = JSON.parse(state.info.metadata);
if (metadata.expiry < Date.now()) {
  throw new Error('Order expired');
}

// Verify maker owns storage account
const acls = await client.listACLsByEntity({
  account: KeetaNet.lib.Account.fromPublicKeyString(storageAccount)
});

const ownerAcl = acls.find(acl => 
  acl.permissions.base.flags.includes('OWNER') &&
  acl.principal.publicKeyString.toString() === makerAddress
);

if (!ownerAcl) {
  throw new Error('Maker does not own storage account');
}
```

**Trust Minimization:**
- Taker trusts only Keeta blockchain (not backend, not maker)
- All verification data is on-chain
- Backend can lie, but taker checks blockchain directly
- Maker cannot fake locked funds (on-chain balance is truth)

---

## Performance Considerations

### Settlement Speed

**Keeta Network Performance:**
- **Average Settlement**: 400 milliseconds
- **Throughput**: 10 million TPS capacity
- **Finality**: Permanent after vote staple confirmation

**RFQ Transaction Times:**

| Operation | Expected Time | Keeta Actions |
|-----------|--------------|---------------|
| **Order Creation** | ~400ms | Create storage + transfer funds |
| **Order Fill** | ~400ms | Two transfers in one vote staple |
| **Order Cancel** | ~400ms | Withdraw from storage |
| **Balance Query** | ~50ms | Read account state (no consensus) |

**Comparison with Other Blockchains:**

| Blockchain | Settlement Time | Notes |
|------------|----------------|-------|
| **Keeta** | 400ms | DAG architecture, representative voting |
| Ethereum | 12s (1 block) | Proof of Stake |
| Bitcoin | 10min (1 block) | Proof of Work |
| Solana | 400ms | Similar to Keeta |
| Polygon | 2s | Layer 2 |

### Gas Fees

**Keeta Gas Model:**
- **Dynamic Fees**: Representatives adjust fees based on network load
- **Spam Prevention**: Higher fees during congestion
- **Typical Cost**: Very low (designed for high throughput)

**RFQ Operation Costs:**

| Operation | Estimated Gas | Notes |
|-----------|--------------|-------|
| Create Storage Account | Low | One-time account creation |
| Transfer Funds | Very Low | Simple send operation |
| Update Permissions | Low | ACL modification |
| Query Balance | Free | Read-only operation |

**Cost Optimization Strategies:**
1. **Batch Operations**: Combine multiple operations in one transaction
2. **Off-Peak Trading**: Trade during low network congestion
3. **Efficient Metadata**: Keep order metadata compact (less data = less gas)

### Scalability

**Backend Scalability:**
- Backend only indexes, doesn't process transactions
- Can scale horizontally (multiple indexer instances)
- Cache frequently queried orders in Redis
- Use database for historical order data

**Blockchain Scalability:**
- Keeta handles 10M TPS natively
- Each account has separate blockchain (parallel processing)
- No global state bottleneck (unlike Ethereum)
- RFQ orders don't compete for the same blockchain space

**Load Testing Targets:**
- 1,000 concurrent orders
- 100 fills per second
- 10,000 total orders in database
- <100ms backend API response time

---

## Testing Strategy

### Unit Tests

**Frontend Tests:**
```typescript
// src/app/lib/__tests__/token-utils.test.ts

describe('Token Utils', () => {
  it('should get correct token address for sell order', () => {
    const address = getTokenAddress('KTA/USDT', 'sell');
    expect(address).toBe(TOKEN_ADDRESSES.USDT);  // Selling, so locking USDT
  });

  it('should convert amounts to base units correctly', () => {
    const amount = toBaseUnits(100.5, 6);
    expect(amount).toBe(100500000n);  // 100.5 * 10^6
  });
});
```

**Backend Tests:**
```rust
// keythings-dapp-engine/src/tests/rfq_tests.rs

#[tokio::test]
async fn test_index_rfq_order() {
    let mut manager = KeetaRFQManager::new();
    
    let order = RFQOrderData {
        id: "test-order-1".to_string(),
        maker_pubkey: "keeta_maker123".to_string(),
        pair: "KTA/USDT".to_string(),
        side: "sell".to_string(),
        price: 200.0,
        size: 100.0,
        min_fill: Some(10.0),
        expiry: "2025-12-31T23:59:59Z".to_string(),
    };
    
    let result = manager.index_rfq_order("keeta_storage_abc123", order).await;
    
    assert!(result.is_ok());
    assert_eq!(result.unwrap().storage_account, "keeta_storage_abc123");
}
```

### Integration Tests

**Keeta Testnet Integration:**
```typescript
// tests/integration/keeta-rfq.test.ts

describe('RFQ Keeta Integration', () => {
  let maker: KeetaNet.lib.Account;
  let taker: KeetaNet.lib.Account;
  let makerClient: KeetaNet.UserClient;
  let takerClient: KeetaNet.UserClient;
  
  beforeAll(async () => {
    // Create test accounts on Keeta testnet
    const seed = KeetaNet.lib.Account.generateRandomSeed({ asString: true });
    maker = KeetaNet.lib.Account.fromSeed(seed, 0);
    taker = KeetaNet.lib.Account.fromSeed(seed, 1);
    
    makerClient = KeetaNet.UserClient.fromNetwork('test', maker);
    takerClient = KeetaNet.UserClient.fromNetwork('test', taker);
    
    // Fund accounts with test tokens
    await fundAccount(maker.publicKeyString.toString(), 1000, 'USDT');
    await fundAccount(taker.publicKeyString.toString(), 10, 'KTA');
  });
  
  it('should create RFQ order with storage account', async () => {
    const storageManager = new StorageAccountManager(makerClient);
    
    const storageAddress = await storageManager.createRFQStorage({
      pair: 'KTA/USDT',
      side: 'sell',
      price: 200.0,
      size: 100.0,
      minFill: 10.0,
      expiry: new Date(Date.now() + 3600000).toISOString(),
      tokenAddress: USDT_TOKEN_ADDRESS,
      decimals: 6
    });
    
    expect(storageAddress).toMatch(/^keeta_/);
    
    // Verify storage account on blockchain
    const balance = await makerClient.allBalances({
      account: KeetaNet.lib.Account.fromPublicKeyString(storageAddress)
    });
    
    expect(balance.get(USDT_TOKEN_ADDRESS)).toBe(100000000n);  // 100 USDT
  });
  
  it('should fill RFQ order atomically', async () => {
    // Create order
    const storageAddress = await createTestOrder(makerClient);
    
    // Fill order
    const builder = takerClient.initBuilder();
    
    builder.send(
      maker,
      500000n,  // 0.5 KTA
      KTA_TOKEN
    );
    
    builder.send(
      taker,
      100000000n,  // 100 USDT
      USDT_TOKEN,
      undefined,
      { account: KeetaNet.lib.Account.fromPublicKeyString(storageAddress) }
    );
    
    await takerClient.publishBuilder(builder);
    
    // Verify balances after fill
    const makerBalance = await makerClient.allBalances();
    const takerBalance = await takerClient.allBalances();
    
    expect(makerBalance.get(KTA_TOKEN)).toBe(500000n);  // Received 0.5 KTA
    expect(takerBalance.get(USDT_TOKEN)).toBe(100000000n);  // Received 100 USDT
  });
  
  it('should cancel order and return funds to maker', async () => {
    const storageAddress = await createTestOrder(makerClient);
    
    const storageManager = new StorageAccountManager(makerClient);
    await storageManager.withdrawFromStorage(
      storageAddress,
      USDT_TOKEN_ADDRESS,
      100.0,
      6
    );
    
    // Verify maker received funds back
    const makerBalance = await makerClient.allBalances();
    expect(makerBalance.get(USDT_TOKEN)).toBeGreaterThanOrEqual(1000000000n);
  });
});
```

### E2E Tests

**Full RFQ Flow:**
```typescript
// tests/e2e/rfq-flow.test.ts

describe('Complete RFQ Flow', () => {
  it('should execute maker → publish → taker → fill flow', async () => {
    // 1. Maker creates order via UI
    await page.goto('http://localhost:3000/trade');
    await page.click('[data-testid="maker-tab"]');
    
    await page.fill('[data-testid="price-input"]', '200');
    await page.fill('[data-testid="size-input"]', '100');
    await page.select('[data-testid="expiry-select"]', '1h');
    
    await page.click('[data-testid="publish-button"]');
    
    // Wait for wallet extension prompt
    await waitForWalletPrompt();
    await approveWalletTransaction();
    
    // Verify order appears in order book
    await page.waitForSelector('[data-testid="order-book"]');
    const orderElement = await page.$('[data-order-id]');
    const orderId = await orderElement.getAttribute('data-order-id');
    
    expect(orderId).toBeTruthy();
    
    // 2. Taker fills order
    await page.click('[data-testid="taker-tab"]');
    await page.click(`[data-order-id="${orderId}"]`);
    
    await page.fill('[data-testid="fill-amount-input"]', '100');
    await page.click('[data-testid="fill-button"]');
    
    // Wait for wallet extension prompt
    await waitForWalletPrompt();
    await approveWalletTransaction();
    
    // Verify fill success
    await page.waitForSelector('[data-testid="fill-success"]');
    const successMessage = await page.textContent('[data-testid="fill-success"]');
    
    expect(successMessage).toContain('filled successfully');
    
    // 3. Verify on Keeta blockchain
    const storageAddress = await getOrderStorageAddress(orderId);
    const balance = await queryKeetaBalance(storageAddress);
    
    expect(balance).toBe(0n);  // Storage account emptied after fill
  });
});
```

### Manual Testing Checklist

**Pre-Deployment Testing:**

- [ ] **Order Creation**
  - [ ] Create order with wallet signature
  - [ ] Verify storage account on Keeta explorer
  - [ ] Check locked funds balance
  - [ ] Validate order metadata
  - [ ] Confirm order appears in UI

- [ ] **Order Discovery**
  - [ ] Query orders from backend
  - [ ] Verify on-chain balances
  - [ ] Check order expiry
  - [ ] Filter by trading pair

- [ ] **Order Fill**
  - [ ] Fill order with taker wallet
  - [ ] Verify atomic swap execution
  - [ ] Check both balances updated
  - [ ] Confirm fill on Keeta explorer
  - [ ] Validate order status update

- [ ] **Order Cancel**
  - [ ] Cancel order with maker wallet
  - [ ] Verify funds returned to maker
  - [ ] Check storage account emptied
  - [ ] Confirm cancel on Keeta explorer

- [ ] **Error Handling**
  - [ ] Insufficient maker funds
  - [ ] Insufficient taker funds
  - [ ] Expired order fill attempt
  - [ ] Invalid token addresses
  - [ ] Wallet connection lost
  - [ ] Backend API down

---

## Deployment Checklist

### Pre-Deployment

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] E2E tests executed on testnet
- [ ] Manual testing completed
- [ ] Security audit performed
- [ ] Performance benchmarks met
- [ ] Documentation updated

### Environment Setup

- [ ] Keeta testnet token addresses configured
- [ ] RPC endpoints configured
- [ ] Wallet extension integrated
- [ ] Backend API endpoints secured
- [ ] Monitoring and logging set up

### Post-Deployment

- [ ] Verify order creation on mainnet
- [ ] Test order fill with real funds (small amount)
- [ ] Monitor settlement times
- [ ] Track gas fees
- [ ] Verify backend indexing
- [ ] Set up alerts for failures

---

## Conclusion

This RFQ system leverages Keeta Network's unique features to create a trustless, non-custodial trading platform:

**Key Achievements:**
- ✅ Zero-custody architecture (backend never controls funds)
- ✅ On-chain escrow via storage accounts
- ✅ Sub-second settlement (~400ms)
- ✅ Atomic transactions (vote staples)
- ✅ Verifiable fund locking (on-chain balances)
- ✅ User-signed transactions (Keeta Wallet Extension)

**Future Enhancements:**
- Multi-sig storage accounts for institutional orders
- Order routing and aggregation
- Advanced order types (limit, stop-loss)
- Cross-chain RFQ support (leverage Keeta's interoperability)
- Real-time order book streaming via WebSocket
- Maker reputation system (on-chain track record)

**Production Readiness:**
- Comprehensive testing strategy
- Security-first architecture
- Performance optimization
- Monitoring and observability
- Clear deployment process

This design positions KeyThings as a showcase for Keeta Network's capabilities while providing users with a secure, fast, and trustless trading experience.

