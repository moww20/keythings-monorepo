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

### Data Flow

#### Order Placement Flow
```
1. User → Frontend: Place limit order (USDX/USDT @ 1.0001)
2. Frontend → Backend: POST /orders/place
3. Backend: Validate user balance (internal ledger)
4. Backend: Reserve internal balance
5. Backend: Add to CLOB order book
6. Backend: Match against opposite side
7. Backend: Execute fills (internal ledger update)
8. Backend → Frontend: Order confirmation (WebSocket)
```

#### Withdrawal Flow
```
1. User → Frontend: Request withdrawal (100 USDT)
2. Frontend → Backend: POST /withdrawals/request
3. Backend: Debit internal ledger
4. Backend: Queue withdrawal in settlement orchestrator
5. Backend → Keeta: Build SEND block from S_user
6. Backend: Sign with operator key (SEND_ON_BEHALF)
7. Keeta: Validate ACL permissions
8. Keeta: Execute SEND (400ms finality)
9. Backend → Frontend: Withdrawal complete
```

#### Deposit Flow
```
1. User → Frontend: Get deposit address
2. Frontend → Backend: GET /deposits/address
3. Backend: Return user's S_user address
4. User → Keeta: Send tokens to S_user (direct on-chain)
5. Backend: Monitor S_user balance changes
6. Backend: Credit internal ledger
7. Backend → Frontend: Balance update (WebSocket)
```

---

## Phase 1: Backend Infrastructure

### 1.1 Project Structure

```
backend/
├── Cargo.toml
├── docker/
│   ├── docker-compose.yml
│   └── Dockerfile
└── src/
    ├── main.rs              # Server entry point
    ├── api.rs               # REST API routes
    ├── websocket.rs         # WebSocket server
    ├── models.rs            # Data structures
    ├── engine.rs            # CLOB matching engine
    ├── ledger.rs            # Internal ledger (PostgreSQL)
    ├── keeta.rs             # Keeta RPC client
    ├── settlement.rs        # Withdrawal orchestration
    ├── reconcile.rs         # Balance reconciliation
    ├── auth.rs              # Authentication
    └── utils.rs             # Helper functions
```

### 1.2 Core Services

#### Authentication Service
**Purpose**: Challenge/response authentication using user's Keeta keypair

**Flow**:
```rust
// 1. Client requests challenge
POST /auth/challenge
Response: { nonce: "uuid-v4" }

// 2. Client signs challenge with private key
let message = format!("keeta-login:{nonce}");
let signature = sign(message, user_private_key);

// 3. Client submits signature
POST /auth/verify
Body: { pubkey: "base58", signature: "base58" }
Response: { userId: "pubkey", jwt: "jwt-token" }

// 4. JWT used for all subsequent requests
Authorization: Bearer <jwt-token>
```

**Implementation**:
```rust
#[post("/auth/challenge")]
pub async fn auth_challenge() -> HttpResponse {
    let nonce = Uuid::new_v4().to_string();
    // Store nonce with expiry (5 minutes)
    HttpResponse::Ok().json(AuthChallenge { nonce })
}

#[post("/auth/verify")]
pub async fn auth_verify(body: web::Json<VerifyBody>) -> HttpResponse {
    // 1. Verify signature against challenge
    // 2. Issue JWT with claims: { sub: pubkey, exp: timestamp }
    // 3. Store session
    HttpResponse::Ok().json(AuthSession { user_id, jwt })
}
```

---

#### Order Gateway
**Purpose**: Validate and intake orders into the matching engine

**Validation Checks**:
- User authentication (valid JWT)
- Balance availability (internal ledger)
- Order parameters (price, quantity, market)
- Rate limiting (prevent spam)
- Market existence
- Min/max order size

**Implementation**:
```rust
#[post("/orders/place")]
pub async fn place_order(
    state: web::Data<AppState>,
    auth: JwtAuth,
    body: web::Json<LimitOrder>
) -> HttpResponse {
    let user_id = auth.user_id;
    let order = body.into_inner();
    
    // Validate market exists
    if !state.markets.contains(&order.market) {
        return HttpResponse::BadRequest().json("Invalid market");
    }
    
    // Send to engine for balance check and matching
    let (tx, rx) = tokio::sync::oneshot::channel();
    state.engine.tx_cmd.send(EngineCmd::Place {
        user_id,
        order,
        resp: tx
    });
    
    let placed = rx.await.unwrap();
    HttpResponse::Ok().json(placed)
}
```

---

#### CLOB Matching Engine
**Purpose**: Price-time priority order matching

**Data Structures**:
```rust
// Per-market order books
struct OrderBook {
    market: String,
    bids: BTreeMap<Decimal, VecDeque<Order>>, // Price -> Orders
    asks: BTreeMap<Decimal, VecDeque<Order>>,
}

struct Order {
    id: String,
    user_id: String,
    side: Side,
    price: Decimal,
    quantity: Decimal,
    filled_quantity: Decimal,
    status: OrderStatus,
    timestamp: DateTime<Utc>,
}
```

**Matching Algorithm**:
```rust
fn match_order(order: Order, book: &mut OrderBook, ledger: &Ledger) {
    match order.side {
        Side::Buy => {
            // Match against asks (lowest price first)
            while let Some((ask_price, ask_queue)) = book.asks.first_entry() {
                if order.price < *ask_price { break; } // No more matches
                if order.filled_quantity >= order.quantity { break; } // Fully filled
                
                if let Some(mut ask_order) = ask_queue.pop_front() {
                    let fill_qty = min(
                        order.quantity - order.filled_quantity,
                        ask_order.quantity - ask_order.filled_quantity
                    );
                    
                    // Execute fill in internal ledger
                    ledger.execute_trade(
                        &order.user_id,
                        &ask_order.user_id,
                        &order.market,
                        *ask_price,
                        fill_qty
                    );
                    
                    // Update fill quantities
                    order.filled_quantity += fill_qty;
                    ask_order.filled_quantity += fill_qty;
                    
                    // Push back if not fully filled
                    if ask_order.filled_quantity < ask_order.quantity {
                        ask_queue.push_front(ask_order);
                    }
                }
            }
        }
        Side::Sell => {
            // Match against bids (highest price first)
            // Similar logic as above
        }
    }
    
    // Add remainder to book if not fully filled
    if order.filled_quantity < order.quantity {
        match order.side {
            Side::Buy => book.bids.entry(order.price).or_default().push_back(order),
            Side::Sell => book.asks.entry(order.price).or_default().push_back(order),
        }
    }
}
```

---

#### Internal Ledger (PostgreSQL)
**Purpose**: Source of truth for off-chain balances and fills

**Schema**:
```sql
CREATE TABLE balances (
    user_id UUID NOT NULL,
    token TEXT NOT NULL,
    available NUMERIC(36,0) NOT NULL DEFAULT 0,
    total NUMERIC(36,0) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, token)
);

CREATE TABLE fills (
    id UUID PRIMARY KEY,
    market TEXT NOT NULL,
    bid_order_id UUID NOT NULL,
    ask_order_id UUID NOT NULL,
    bid_user_id UUID NOT NULL,
    ask_user_id UUID NOT NULL,
    price NUMERIC(36,18) NOT NULL,
    quantity NUMERIC(36,18) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fills_user ON fills(bid_user_id, ask_user_id);
CREATE INDEX idx_fills_market ON fills(market, created_at DESC);
```

**Operations**:
```rust
impl Ledger {
    // Credit user balance (deposit)
    pub async fn credit(&self, user_id: &str, token: &str, amount: i128) {
        sqlx::query!(
            "INSERT INTO balances (user_id, token, available, total)
             VALUES ($1, $2, $3, $3)
             ON CONFLICT (user_id, token) 
             DO UPDATE SET
                available = balances.available + $3,
                total = balances.total + $3,
                updated_at = NOW()",
            user_id, token, amount
        )
        .execute(&self.pool)
        .await?;
    }
    
    // Reserve balance for order
    pub async fn reserve(&self, user_id: &str, token: &str, amount: i128) -> bool {
        let result = sqlx::query!(
            "UPDATE balances
             SET available = available - $3
             WHERE user_id = $1 AND token = $2 AND available >= $3
             RETURNING available",
            user_id, token, amount
        )
        .fetch_optional(&self.pool)
        .await?;
        
        result.is_some()
    }
    
    // Execute trade (internal transfer)
    pub async fn execute_trade(
        &self,
        buyer_id: &str,
        seller_id: &str,
        market: &str,
        price: Decimal,
        quantity: Decimal
    ) {
        let (base, quote) = parse_market(market);
        let cost = price * quantity;
        
        let mut tx = self.pool.begin().await?;
        
        // Buyer: pay quote, receive base
        sqlx::query!(
            "UPDATE balances SET total = total - $3 WHERE user_id = $1 AND token = $2",
            buyer_id, quote, cost
        ).execute(&mut tx).await?;
        
        sqlx::query!(
            "INSERT INTO balances (user_id, token, available, total) VALUES ($1, $2, $3, $3)
             ON CONFLICT (user_id, token) DO UPDATE SET
                available = balances.available + $3, total = balances.total + $3",
            buyer_id, base, quantity
        ).execute(&mut tx).await?;
        
        // Seller: receive quote, give base
        sqlx::query!(
            "UPDATE balances SET total = total - $3 WHERE user_id = $1 AND token = $2",
            seller_id, base, quantity
        ).execute(&mut tx).await?;
        
        sqlx::query!(
            "INSERT INTO balances (user_id, token, available, total) VALUES ($1, $2, $3, $3)
             ON CONFLICT (user_id, token) DO UPDATE SET
                available = balances.available + $3, total = balances.total + $3",
            seller_id, quote, cost
        ).execute(&mut tx).await?;
        
        // Record fill
        sqlx::query!(
            "INSERT INTO fills (id, market, bid_user_id, ask_user_id, price, quantity)
             VALUES ($1, $2, $3, $4, $5, $6)",
            Uuid::new_v4(), market, buyer_id, seller_id, price, quantity
        ).execute(&mut tx).await?;
        
        tx.commit().await?;
    }
}
```

---

#### Keeta Integration Layer
**Purpose**: Interact with Keeta Network for on-chain operations

**Components**:
```rust
pub struct KeetaClient {
    user_client: KeetaNet::UserClient,
    operator_account: Account,
    network: String,
}

impl KeetaClient {
    // Create storage account for user
    pub async fn create_storage_account(&self, user_pubkey: &str) -> Result<String> {
        let builder = self.user_client.init_builder();
        
        let pending_storage = builder.generate_identifier(
            AccountKeyAlgorithm::STORAGE
        );
        builder.compute_blocks().await;
        
        let storage_account = pending_storage.account;
        
        // Set default permissions
        builder.set_info(
            SetInfoParams {
                name: "Exchange Storage Account",
                description: format!("Storage account for user {}", user_pubkey),
                default_permission: Permissions::from_flags(&[
                    "STORAGE_DEPOSIT", // Anyone can deposit
                    "STORAGE_CAN_HOLD", // Can hold any token
                ])
            },
            SetInfoOptions { account: storage_account }
        );
        
        // Grant user OWNER permission
        let user_account = Account::from_public_key(user_pubkey);
        builder.update_permissions(
            user_account,
            Permissions::from_flags(&["OWNER"]),
            None,
            None,
            UpdatePermissionsOptions { account: storage_account }
        );
        
        // Grant operator SEND_ON_BEHALF (scoped)
        builder.update_permissions(
            self.operator_account,
            Permissions::from_flags(&["SEND_ON_BEHALF"]),
            Some(token_account), // Scope to specific token
            None,
            UpdatePermissionsOptions { account: storage_account }
        );
        
        self.user_client.publish_builder(builder).await?;
        
        Ok(storage_account.public_key_string.to_string())
    }
    
    // Execute withdrawal (SEND_ON_BEHALF)
    pub async fn send_on_behalf(
        &self,
        from_storage: &str,
        to: &str,
        token: &str,
        amount: i128
    ) -> Result<String> {
        let storage_account = Account::from_public_key(from_storage);
        let dest_account = Account::from_public_key(to);
        let token_account = Account::from_public_key(token);
        
        let builder = self.user_client.init_builder();
        
        // Build SEND operation
        builder.send(
            dest_account,
            amount,
            SendOptions {
                token: Some(token_account),
                signer: Some(self.operator_account), // Sign as operator
                account: Some(storage_account), // From storage account
                ..Default::default()
            }
        );
        
        let staple = self.user_client.publish_builder(builder).await?;
        
        Ok(staple.blocks[0].hash.to_string())
    }
    
    // Get balance from chain
    pub async fn get_balance(&self, account: &str, token: &str) -> Result<i128> {
        let account = Account::from_public_key(account);
        let token = Account::from_public_key(token);
        
        let balance = self.user_client.balance(
            BalanceOptions {
                account: Some(account),
                token: Some(token),
                ..Default::default()
            }
        ).await?;
        
        Ok(balance)
    }
}
```

---

#### Settlement Orchestrator
**Purpose**: Process withdrawal queue and submit to Keeta

**Implementation**:
```rust
pub struct SettlementOrchestrator {
    keeta: Arc<KeetaClient>,
    withdrawal_queue: UnboundedReceiver<Withdrawal>,
    ledger: Arc<Ledger>,
}

impl SettlementOrchestrator {
    pub async fn run(&mut self) {
        while let Some(withdrawal) = self.withdrawal_queue.recv().await {
            match self.process_withdrawal(withdrawal).await {
                Ok(tx_hash) => {
                    // Update withdrawal status
                    self.ledger.update_withdrawal_status(
                        &withdrawal.id,
                        "completed",
                        Some(&tx_hash)
                    ).await;
                }
                Err(e) => {
                    log::error!("Withdrawal failed: {:?}", e);
                    // Retry logic or mark as failed
                    self.ledger.update_withdrawal_status(
                        &withdrawal.id,
                        "failed",
                        None
                    ).await;
                    
                    // Credit back to user's available balance
                    self.ledger.credit(
                        &withdrawal.user_id,
                        &withdrawal.token,
                        withdrawal.amount
                    ).await;
                }
            }
        }
    }
    
    async fn process_withdrawal(&self, w: Withdrawal) -> Result<String> {
        // Get user's storage account
        let storage_account = self.ledger
            .get_user_storage_account(&w.user_id)
            .await?;
        
        // Execute SEND_ON_BEHALF
        let tx_hash = self.keeta.send_on_behalf(
            &storage_account,
            &w.destination,
            &w.token,
            w.amount
        ).await?;
        
        Ok(tx_hash)
    }
}
```

---

#### Reconciliation Worker
**Purpose**: Ensure internal ledger matches on-chain balances

**Implementation**:
```rust
pub struct ReconciliationWorker {
    keeta: Arc<KeetaClient>,
    ledger: Arc<Ledger>,
}

impl ReconciliationWorker {
    pub async fn run(&self) {
        let mut interval = tokio::time::interval(Duration::from_secs(300)); // Every 5 min
        
        loop {
            interval.tick().await;
            
            if let Err(e) = self.reconcile().await {
                log::error!("Reconciliation failed: {:?}", e);
            }
        }
    }
    
    async fn reconcile(&self) -> Result<()> {
        // Get all users with storage accounts
        let users = self.ledger.get_all_users().await?;
        
        for user in users {
            let storage_account = self.ledger
                .get_user_storage_account(&user.id)
                .await?;
            
            // Get tokens user has balance in
            let tokens = self.ledger
                .get_user_tokens(&user.id)
                .await?;
            
            for token in tokens {
                // Get on-chain balance (fully consistent read)
                let on_chain = self.keeta
                    .get_balance(&storage_account, &token)
                    .await?;
                
                // Get internal ledger total
                let internal = self.ledger
                    .get_user_balance(&user.id, &token)
                    .await?;
                
                // Compare
                let diff = on_chain - internal.total;
                
                if diff.abs() > 0 {
                    log::warn!(
                        "Balance drift detected: user={}, token={}, on_chain={}, internal={}, diff={}",
                        user.id, token, on_chain, internal.total, diff
                    );
                    
                    // Alert system
                    self.alert_drift(&user.id, &token, diff).await;
                    
                    // Auto-correct if within threshold
                    if diff.abs() < 1000 { // Small dust amounts
                        self.ledger.adjust_balance(&user.id, &token, diff).await?;
                    }
                }
            }
        }
        
        Ok(())
    }
}
```

---

### 1.3 Dependencies (Cargo.toml)

```toml
[package]
name = "keeta-dex-backend"
version = "0.1.0"
edition = "2021"

[dependencies]
# Web framework
actix-web = "4"
actix-rt = "2"
actix-cors = "0.7"

# WebSocket
actix-web-actors = "4"
actix = "0.13"

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Database
sqlx = { version = "0.7", features = ["runtime-tokio-native-tls", "postgres", "uuid", "chrono", "bigdecimal"] }

# Async runtime
tokio = { version = "1", features = ["full"] }

# UUID generation
uuid = { version = "1", features = ["v4", "serde"] }

# Authentication
jsonwebtoken = "9"

# Decimal arithmetic
rust_decimal = "1.33"
bigdecimal = "0.4"

# Redis for caching
redis = { version = "0.24", features = ["tokio-comp", "connection-manager"] }

# Keeta SDK (when available)
# keeta-sdk = "0.1"

# Logging
log = "0.4"
env_logger = "0.11"

# Error handling
thiserror = "1"
anyhow = "1"

# Collections
dashmap = "5"

# Cryptography
ed25519-dalek = "2"
bs58 = "0.5"

# Time
chrono = { version = "0.4", features = ["serde"] }

# Configuration
config = "0.14"
dotenv = "0.15"
```

---

## Phase 2: Frontend Integration

### 2.1 Enhanced Trading Page

**Location**: `src/app/(wallet)/trade/page.tsx`

**Current Components** (already exist):
- ✅ `TradingViewChart` - Chart display
- ✅ `OrderBook` - Order book display
- ✅ `RFQOrderPanel` - Order placement
- ✅ `MarketTrades` - Recent trades
- ✅ `TradingPairSelector` - Market selector

**Enhancements Needed**:

```typescript
// src/app/(wallet)/trade/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/app/contexts/WalletContext';
import { TradingViewChart } from '@/app/components/TradingViewChart';
import { OrderBook } from '@/app/components/OrderBook';
import { OrderPanel } from '@/app/components/OrderPanel';
import { TradeHistory } from '@/app/components/TradeHistory';
import { UserOrders } from '@/app/components/UserOrders';
import { TradingPairSelector } from '@/app/components/TradingPairSelector';
import { useWebSocket } from '@/app/hooks/useWebSocket';
import { useDexApi } from '@/app/hooks/useDexApi';

export default function TradePage() {
  const { isConnected, publicKey } = useWallet();
  const [selectedPair, setSelectedPair] = useState('USDX/USDT');
  const dexApi = useDexApi();
  
  // WebSocket connection for real-time updates
  const { orderBook, trades, userOrders } = useWebSocket(selectedPair);
  
  // Fetch initial data
  useEffect(() => {
    if (selectedPair) {
      dexApi.subscribeToMarket(selectedPair);
    }
    
    return () => {
      dexApi.unsubscribeFromMarket(selectedPair);
    };
  }, [selectedPair]);
  
  const handlePlaceOrder = async (order: OrderParams) => {
    try {
      const result = await dexApi.placeOrder(order);
      console.log('Order placed:', result);
    } catch (error) {
      console.error('Failed to place order:', error);
    }
  };
  
  return (
    <div className="min-h-screen bg-[color:var(--background)] p-6">
      <div className="max-w-[1920px] mx-auto">
        {/* Market Selector */}
        <div className="mb-6">
          <TradingPairSelector 
            selected={selectedPair}
            onChange={setSelectedPair}
          />
        </div>
        
        {/* Main Trading Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Chart - 8 columns */}
          <div className="col-span-12 lg:col-span-8">
            <div className="glass rounded-lg border border-hairline p-4">
              <TradingViewChart pair={selectedPair} />
            </div>
          </div>
          
          {/* Order Book - 4 columns */}
          <div className="col-span-12 lg:col-span-4">
            <div className="glass rounded-lg border border-hairline p-4">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Order Book
              </h3>
              <OrderBook data={orderBook} />
            </div>
          </div>
          
          {/* Order Panel - 4 columns */}
          <div className="col-span-12 lg:col-span-4">
            <div className="glass rounded-lg border border-hairline p-4">
              <OrderPanel 
                pair={selectedPair}
                onPlaceOrder={handlePlaceOrder}
                disabled={!isConnected}
              />
            </div>
          </div>
          
          {/* Trade History - 4 columns */}
          <div className="col-span-12 lg:col-span-4">
            <div className="glass rounded-lg border border-hairline p-4">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Recent Trades
              </h3>
              <TradeHistory trades={trades} />
            </div>
          </div>
          
          {/* User Orders - 4 columns */}
          <div className="col-span-12 lg:col-span-4">
            <div className="glass rounded-lg border border-hairline p-4">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Your Orders
              </h3>
              <UserOrders orders={userOrders} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### 2.2 New Components

#### OrderPanel Component
```typescript
// src/app/components/OrderPanel.tsx
'use client';

import { useState } from 'react';
import { z } from 'zod';

const OrderSchema = z.object({
  market: z.string(),
  side: z.enum(['buy', 'sell']),
  price: z.string().regex(/^\d+(\.\d+)?$/),
  quantity: z.string().regex(/^\d+(\.\d+)?$/),
  type: z.enum(['limit', 'market']).default('limit'),
});

type OrderParams = z.infer<typeof OrderSchema>;

export function OrderPanel({ pair, onPlaceOrder, disabled }) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = OrderSchema.safeParse({
      market: pair,
      side,
      price: orderType === 'market' ? '0' : price,
      quantity,
      type: orderType,
    });
    
    if (!result.success) {
      console.error('Validation failed:', result.error);
      return;
    }
    
    setLoading(true);
    try {
      await onPlaceOrder(result.data);
      setPrice('');
      setQuantity('');
    } catch (error) {
      console.error('Order failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setSide('buy')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            side === 'buy'
              ? 'bg-green-500 text-white'
              : 'bg-surface text-muted hover:bg-surface-strong'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide('sell')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            side === 'sell'
              ? 'bg-red-500 text-white'
              : 'bg-surface text-muted hover:bg-surface-strong'
          }`}
        >
          Sell
        </button>
      </div>
      
      <div className="flex gap-2 text-sm">
        <button
          onClick={() => setOrderType('limit')}
          className={`px-3 py-1 rounded ${
            orderType === 'limit'
              ? 'bg-accent text-white'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Limit
        </button>
        <button
          onClick={() => setOrderType('market')}
          className={`px-3 py-1 rounded ${
            orderType === 'market'
              ? 'bg-accent text-white'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Market
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        {orderType === 'limit' && (
          <div>
            <label className="text-sm text-muted mb-1 block">Price</label>
            <input
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-2 bg-surface border border-hairline rounded-lg text-foreground focus:outline-none focus:border-accent"
              disabled={disabled || loading}
            />
          </div>
        )}
        
        <div>
          <label className="text-sm text-muted mb-1 block">Quantity</label>
          <input
            type="text"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-2 bg-surface border border-hairline rounded-lg text-foreground focus:outline-none focus:border-accent"
            disabled={disabled || loading}
          />
        </div>
        
        <button
          type="submit"
          disabled={disabled || loading}
          className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
            side === 'buy'
              ? 'bg-green-500 hover:bg-green-600'
              : 'bg-red-500 hover:bg-red-600'
          } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? 'Placing Order...' : `${side.toUpperCase()} ${pair.split('/')[0]}`}
        </button>
      </form>
      
      {disabled && (
        <p className="text-sm text-muted text-center">
          Connect wallet to trade
        </p>
      )}
    </div>
  );
}
```

---

#### UserOrders Component
```typescript
// src/app/components/UserOrders.tsx
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

export function UserOrders({ orders }) {
  const [activeTab, setActiveTab] = useState<'open' | 'history'>('open');
  
  const openOrders = orders?.filter(o => o.status === 'resting' || o.status === 'partially_filled') || [];
  const historyOrders = orders?.filter(o => o.status === 'filled' || o.status === 'canceled') || [];
  
  const displayOrders = activeTab === 'open' ? openOrders : historyOrders;
  
  const handleCancel = async (orderId: string) => {
    // TODO: Implement cancel order
    console.log('Cancel order:', orderId);
  };
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-hairline">
        <button
          onClick={() => setActiveTab('open')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'open'
              ? 'text-accent border-b-2 border-accent'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Open Orders ({openOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-accent border-b-2 border-accent'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Order History
        </button>
      </div>
      
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {displayOrders.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">
            No {activeTab} orders
          </p>
        ) : (
          displayOrders.map(order => (
            <div
              key={order.id}
              className="flex items-center justify-between p-3 bg-surface rounded-lg hover:bg-surface-strong transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-medium ${
                    order.side === 'buy' ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {order.side.toUpperCase()}
                  </span>
                  <span className="text-sm text-foreground">
                    {order.market}
                  </span>
                </div>
                <div className="text-xs text-muted space-x-3">
                  <span>Price: {order.price}</span>
                  <span>Qty: {order.quantity}</span>
                  {order.filled_quantity > 0 && (
                    <span>Filled: {order.filled_quantity}</span>
                  )}
                </div>
              </div>
              
              {activeTab === 'open' && (
                <button
                  onClick={() => handleCancel(order.id)}
                  className="p-2 text-muted hover:text-red-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

---

### 2.3 WebSocket Hook

```typescript
// src/app/hooks/useWebSocket.ts
'use client';

import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@/app/contexts/WalletContext';

interface OrderBookData {
  bids: Array<[string, string]>; // [price, quantity]
  asks: Array<[string, string]>;
}

interface Trade {
  id: string;
  market: string;
  price: string;
  quantity: string;
  side: 'buy' | 'sell';
  timestamp: number;
}

interface Order {
  id: string;
  market: string;
  side: 'buy' | 'sell';
  price: string;
  quantity: string;
  filled_quantity: string;
  status: string;
}

export function useWebSocket(market: string) {
  const { publicKey } = useWallet();
  const [orderBook, setOrderBook] = useState<OrderBookData>({ bids: [], asks: [] });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    if (!market) return;
    
    const ws = new WebSocket(`ws://localhost:8080/ws/trade`);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      
      // Subscribe to market data
      ws.send(JSON.stringify({
        type: 'subscribe',
        channels: [
          `orderbook:${market}`,
          `trades:${market}`,
          ...(publicKey ? [`orders:${publicKey}`] : []),
        ],
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'orderbook':
          setOrderBook(data.data);
          break;
        case 'trade':
          setTrades(prev => [data.data, ...prev].slice(0, 50));
          break;
        case 'order_update':
          setUserOrders(prev => {
            const index = prev.findIndex(o => o.id === data.data.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = data.data;
              return updated;
            }
            return [data.data, ...prev];
          });
          break;
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    return () => {
      ws.close();
    };
  }, [market, publicKey]);
  
  return { orderBook, trades, userOrders };
}
```

---

### 2.4 DEX API Hook

```typescript
// src/app/hooks/useDexApi.ts
'use client';

import { useState } from 'react';
import { useWallet } from '@/app/contexts/WalletContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_DEX_API_URL || 'http://localhost:8080';

export function useDexApi() {
  const { publicKey, signMessage } = useWallet();
  const [token, setToken] = useState<string | null>(null);
  
  // Authentication
  const login = async () => {
    if (!publicKey || !signMessage) {
      throw new Error('Wallet not connected');
    }
    
    // Get challenge
    const challengeRes = await fetch(`${API_BASE_URL}/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const { nonce } = await challengeRes.json();
    
    // Sign challenge
    const message = `keeta-login:${nonce}`;
    const signature = await signMessage(message);
    
    // Verify signature
    const verifyRes = await fetch(`${API_BASE_URL}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey: publicKey,
        signature,
      }),
    });
    
    const { jwt } = await verifyRes.json();
    setToken(jwt);
    return jwt;
  };
  
  // API request helper
  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    let authToken = token;
    
    // Auto-login if no token
    if (!authToken) {
      authToken = await login();
    }
    
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        ...options.headers,
      },
    });
    
    if (!res.ok) {
      throw new Error(`API error: ${res.statusText}`);
    }
    
    return res.json();
  };
  
  // Place order
  const placeOrder = async (order: any) => {
    return apiRequest('/orders/place', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  };
  
  // Cancel order
  const cancelOrder = async (orderId: string) => {
    return apiRequest('/orders/cancel', {
      method: 'POST',
      body: JSON.stringify({ id: orderId }),
    });
  };
  
  // Get balances
  const getBalances = async () => {
    return apiRequest('/balances');
  };
  
  // Get deposit address
  const getDepositAddress = async () => {
    return apiRequest('/deposits/address');
  };
  
  // Request withdrawal
  const requestWithdrawal = async (withdrawal: any) => {
    return apiRequest('/withdrawals/request', {
      method: 'POST',
      body: JSON.stringify(withdrawal),
    });
  };
  
  return {
    login,
    placeOrder,
    cancelOrder,
    getBalances,
    getDepositAddress,
    requestWithdrawal,
  };
}
```

---

## Phase 3: Smart Account Architecture

### 3.1 Storage Account Flow

```typescript
// src/lib/storage-account.ts
import * as KeetaNet from '@keetanetwork/keetanet-client';

export class StorageAccountManager {
  private userClient: KeetaNet.UserClient;
  
  constructor(userClient: KeetaNet.UserClient) {
    this.userClient = userClient;
  }
  
  /**
   * Create storage account for user
   * User will be OWNER, exchange operator gets SEND_ON_BEHALF
   */
  async createStorageAccount(
    exchangeOperatorPubkey: string,
    allowedTokens: string[]
  ): Promise<string> {
    const builder = this.userClient.initBuilder();
    
    // Generate storage account
    const pendingStorage = builder.generateIdentifier(
      KeetaNet.lib.Account.AccountKeyAlgorithm.STORAGE
    );
    
    await builder.computeBlocks();
    const storageAccount = pendingStorage.account;
    
    // Set default permissions
    builder.setInfo({
      name: 'DEX Storage Account',
      description: 'Storage account for decentralized exchange',
      metadata: JSON.stringify({
        created: Date.now(),
        type: 'dex',
      }),
      defaultPermission: new KeetaNet.lib.Permissions([
        'STORAGE_DEPOSIT', // Allow anyone to deposit
        'STORAGE_CAN_HOLD', // Can hold any token
      ]),
    }, { account: storageAccount });
    
    // Grant exchange operator SEND_ON_BEHALF for each token
    const operatorAccount = KeetaNet.lib.Account.fromPublicKeyString(
      exchangeOperatorPubkey
    );
    
    for (const tokenPubkey of allowedTokens) {
      const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(tokenPubkey);
      
      builder.updatePermissions(
        operatorAccount,
        new KeetaNet.lib.Permissions(['SEND_ON_BEHALF']),
        tokenAccount, // Scoped to this token
        undefined,
        { account: storageAccount }
      );
    }
    
    // Publish
    await this.userClient.publishBuilder(builder);
    
    return storageAccount.publicKeyString.toString();
  }
  
  /**
   * Grant additional token permissions
   */
  async grantTokenPermission(
    storageAccountPubkey: string,
    operatorPubkey: string,
    tokenPubkey: string
  ): Promise<void> {
    const builder = this.userClient.initBuilder();
    
    const storageAccount = KeetaNet.lib.Account.fromPublicKeyString(storageAccountPubkey);
    const operatorAccount = KeetaNet.lib.Account.fromPublicKeyString(operatorPubkey);
    const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(tokenPubkey);
    
    builder.updatePermissions(
      operatorAccount,
      new KeetaNet.lib.Permissions(['SEND_ON_BEHALF']),
      tokenAccount,
      undefined,
      { account: storageAccount }
    );
    
    await this.userClient.publishBuilder(builder);
  }
  
  /**
   * Revoke operator permissions (emergency)
   */
  async revokeOperatorPermissions(
    storageAccountPubkey: string,
    operatorPubkey: string
  ): Promise<void> {
    const builder = this.userClient.initBuilder();
    
    const storageAccount = KeetaNet.lib.Account.fromPublicKeyString(storageAccountPubkey);
    const operatorAccount = KeetaNet.lib.Account.fromPublicKeyString(operatorPubkey);
    
    builder.updatePermissions(
      operatorAccount,
      new KeetaNet.lib.Permissions([]), // Empty permissions = revoke
      undefined,
      undefined,
      { account: storageAccount }
    );
    
    await this.userClient.publishBuilder(builder);
  }
  
  /**
   * Self-withdraw (OWNER path) - emergency exit
   */
  async selfWithdraw(
    storageAccountPubkey: string,
    destinationPubkey: string,
    tokenPubkey: string,
    amount: bigint
  ): Promise<string> {
    const builder = this.userClient.initBuilder();
    
    const storageAccount = KeetaNet.lib.Account.fromPublicKeyString(storageAccountPubkey);
    const destAccount = KeetaNet.lib.Account.fromPublicKeyString(destinationPubkey);
    const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(tokenPubkey);
    
    // Build SEND from storage account
    // User is OWNER so can sign on behalf of storage account
    builder.send(
      destAccount,
      amount,
      {
        token: tokenAccount,
        account: storageAccount,
      }
    );
    
    const staple = await this.userClient.publishBuilder(builder);
    return staple.blocks[0].hash.toString();
  }
}
```

---

### 3.2 Permission Viewer Component

```typescript
// src/app/components/PermissionViewer.tsx
'use client';

import { useState, useEffect } from 'react';
import { Shield, AlertCircle, CheckCircle } from 'lucide-react';
import { useWallet } from '@/app/contexts/WalletContext';

export function PermissionViewer() {
  const { userClient } = useWallet();
  const [storageAccount, setStorageAccount] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadPermissions();
  }, [userClient]);
  
  const loadPermissions = async () => {
    if (!userClient) return;
    
    try {
      // Get user's storage accounts
      const acls = await userClient.listACLsByPrincipal();
      const storage = acls.filter(acl => acl.entity.isStorage());
      
      if (storage.length > 0) {
        const storageAddr = storage[0].entity.publicKeyString.toString();
        setStorageAccount(storageAddr);
        
        // Get all ACLs for this storage account
        const entityAcls = await userClient.listACLsByEntity({
          account: storage[0].entity
        });
        
        setPermissions(entityAcls);
      }
    } catch (error) {
      console.error('Failed to load permissions:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <div className="text-muted">Loading permissions...</div>;
  }
  
  if (!storageAccount) {
    return (
      <div className="flex items-center gap-2 text-muted">
        <AlertCircle className="h-5 w-5" />
        <span>No storage account found</span>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-accent" />
        <h3 className="text-lg font-semibold text-foreground">
          Storage Account Permissions
        </h3>
      </div>
      
      <div className="glass rounded-lg border border-hairline p-4">
        <div className="text-sm text-muted mb-2">Storage Account</div>
        <div className="font-mono text-xs text-foreground break-all">
          {storageAccount}
        </div>
      </div>
      
      <div className="space-y-3">
        {permissions.map((acl, index) => (
          <div
            key={index}
            className="glass rounded-lg border border-hairline p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-foreground mb-1">
                  {acl.permissions.base.flags.includes('OWNER')
                    ? 'Owner (You)'
                    : 'Delegated Account'}
                </div>
                <div className="font-mono text-xs text-muted break-all">
                  {acl.principal.publicKeyString.toString()}
                </div>
              </div>
              {acl.permissions.base.flags.includes('OWNER') && (
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              )}
            </div>
            
            <div className="space-y-2">
              <div className="text-xs text-muted">Permissions:</div>
              <div className="flex flex-wrap gap-2">
                {acl.permissions.base.flags.map((flag: string) => (
                  <span
                    key={flag}
                    className="px-2 py-1 bg-surface rounded text-xs font-medium text-foreground"
                  >
                    {flag}
                  </span>
                ))}
              </div>
              
              {acl.target && (
                <div className="mt-2">
                  <div className="text-xs text-muted">Scoped to Token:</div>
                  <div className="font-mono text-xs text-foreground mt-1">
                    {acl.target.publicKeyString.toString()}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Phase 4: Settlement & Reconciliation

### 4.1 Withdrawal Flow Diagram

```
User Requests Withdrawal
         ↓
Frontend → Backend API
         ↓
Validate Request
         ↓
Debit Internal Ledger (available → 0, total unchanged)
         ↓
Queue in Settlement Orchestrator
         ↓
Build Keeta SEND Block
    - From: S_user
    - To: User's destination
    - Signer: Operator (SEND_ON_BEHALF)
         ↓
Submit to Keeta Network
         ↓
Keeta Validates ACL Permissions
         ↓
Execute SEND (~400ms)
         ↓
Update Internal Ledger (total → total - amount)
         ↓
Notify User (WebSocket)
```

### 4.2 Reconciliation Logic

```rust
// Pseudocode for reconciliation

for each user {
    // Get on-chain balance (fully consistent)
    on_chain_balance = keeta.get_balance(user.storage_account, token);
    
    // Get internal ledger total
    internal_total = ledger.get_balance(user.id, token).total;
    
    // Expected: on_chain should equal internal total
    // (available is just reserved for orders, doesn't affect on-chain)
    
    diff = on_chain_balance - internal_total;
    
    if (diff != 0) {
        // Alert
        alert_system(user, token, diff);
        
        // Auto-correct if small dust
        if (abs(diff) < DUST_THRESHOLD) {
            ledger.adjust_balance(user, token, diff);
        }
        
        // Manual review if large
        if (abs(diff) > LARGE_THRESHOLD) {
            flag_for_manual_review(user, token, diff);
        }
    }
}
```

---

## Phase 5: API Design

### 5.1 REST API Endpoints

#### Authentication
```
POST /auth/challenge
Request: { pubkey: "base58" }
Response: { nonce: "uuid" }

POST /auth/verify
Request: { pubkey: "base58", signature: "base58" }
Response: { userId: "pubkey", jwt: "token" }
```

#### Balances
```
GET /balances
Headers: Authorization: Bearer <jwt>
Response: [
  { token: "USDT", available: "10000", total: "10000" },
  { token: "USDX", available: "5000", total: "6000" }
]
```

#### Deposits
```
GET /deposits/address
Headers: Authorization: Bearer <jwt>
Response: { storageAccount: "keeta:S_user_..." }

POST /deposits/notify
Headers: Authorization: Bearer <jwt>
Body: { txHash: "..." }
Response: { status: "processing" }
```

#### Orders
```
POST /orders/place
Headers: Authorization: Bearer <jwt>
Body: {
  market: "USDX/USDT",
  side: "buy",
  type: "limit",
  price: "1.0001",
  quantity: "100"
}
Response: {
  id: "uuid",
  status: "resting",
  ...
}

POST /orders/cancel
Headers: Authorization: Bearer <jwt>
Body: { id: "uuid" }
Response: { id: "uuid", status: "canceled" }

GET /orders
Headers: Authorization: Bearer <jwt>
Query: ?status=open&market=USDX/USDT
Response: [...]

GET /orders/:id
Headers: Authorization: Bearer <jwt>
Response: { id, market, side, ... }
```

#### Withdrawals
```
POST /withdrawals/request
Headers: Authorization: Bearer <jwt>
Body: {
  token: "USDT",
  amount: "1000",
  destination: "keeta:..."
}
Response: { requestId: "uuid", status: "queued" }

GET /withdrawals
Headers: Authorization: Bearer <jwt>
Response: [
  { id, token, amount, status, txHash, createdAt }
]

GET /withdrawals/:id
Headers: Authorization: Bearer <jwt>
Response: { id, token, amount, status, txHash, createdAt }
```

#### Markets
```
GET /markets
Response: [
  { pair: "USDX/USDT", baseToken: "...", quoteToken: "..." }
]

GET /markets/:pair/book
Query: ?depth=20
Response: {
  bids: [["1.0001", "100"], ["1.0000", "200"]],
  asks: [["1.0002", "150"], ["1.0003", "300"]]
}

GET /markets/:pair/trades
Query: ?limit=50
Response: [
  { id, price, quantity, side, timestamp }
]

GET /markets/:pair/ticker
Response: {
  pair: "USDX/USDT",
  lastPrice: "1.0001",
  high24h: "1.0010",
  low24h: "0.9990",
  volume24h: "1000000",
  change24h: "0.05"
}
```

#### Reconciliation (admin)
```
GET /admin/reconciliation/status
Headers: Authorization: Bearer <admin-jwt>
Response: {
  lastRun: "2024-01-01T00:00:00Z",
  discrepancies: [
    { userId, token, onChain, internal, diff }
  ]
}
```

---

### 5.2 WebSocket Protocol

#### Connection
```
ws://api/ws/trade
```

#### Subscribe
```json
{
  "type": "subscribe",
  "channels": [
    "orderbook:USDX/USDT",
    "trades:USDX/USDT",
    "orders:keeta:user_pubkey",
    "balances:keeta:user_pubkey"
  ]
}
```

#### Messages

**Order Book Update**
```json
{
  "type": "orderbook",
  "channel": "orderbook:USDX/USDT",
  "data": {
    "bids": [["1.0001", "100"], ["1.0000", "200"]],
    "asks": [["1.0002", "150"], ["1.0003", "300"]],
    "timestamp": 1234567890
  }
}
```

**Trade**
```json
{
  "type": "trade",
  "channel": "trades:USDX/USDT",
  "data": {
    "id": "uuid",
    "price": "1.0001",
    "quantity": "50",
    "side": "buy",
    "timestamp": 1234567890
  }
}
```

**Order Update**
```json
{
  "type": "order_update",
  "channel": "orders:keeta:user_pubkey",
  "data": {
    "id": "uuid",
    "status": "filled",
    "filled_quantity": "100",
    "timestamp": 1234567890
  }
}
```

**Balance Update**
```json
{
  "type": "balance_update",
  "channel": "balances:keeta:user_pubkey",
  "data": {
    "token": "USDT",
    "available": "9900",
    "total": "9900",
    "timestamp": 1234567890
  }
}
```

---

## Phase 6: Implementation Roadmap

### Sprint 1: Backend Foundation (Week 1-2)
**Goal**: Set up Rust backend infrastructure

**Tasks**:
- [ ] Initialize Rust project with Cargo.toml
- [ ] Set up PostgreSQL database schema
- [ ] Implement authentication service (challenge/response)
- [ ] Create internal ledger module
- [ ] Build Keeta RPC client stub
- [ ] Set up Docker Compose for local development
- [ ] Write unit tests for auth and ledger

**Deliverables**:
- Working auth endpoints
- Database migrations
- Basic health check endpoint

---

### Sprint 2: Matching Engine (Week 3-4)
**Goal**: Implement CLOB order matching

**Tasks**:
- [ ] Design order book data structures
- [ ] Implement price-time priority matching algorithm
- [ ] Build order validation logic
- [ ] Create order lifecycle management
- [ ] Implement balance reservation
- [ ] Add order persistence (PostgreSQL)
- [ ] Write matching engine tests

**Deliverables**:
- Functional CLOB engine
- Order placement API
- Order cancellation API

---

### Sprint 3: Settlement (Week 5-6)
**Goal**: Build settlement orchestrator with Keeta integration

**Tasks**:
- [ ] Implement Keeta SDK integration
- [ ] Build storage account creation
- [ ] Create ACL management utilities
- [ ] Implement SEND_ON_BEHALF transaction builder
- [ ] Build withdrawal queue and processor
- [ ] Implement deposit monitoring
- [ ] Create reconciliation worker
- [ ] Write settlement tests

**Deliverables**:
- Working withdrawals
- Deposit detection
- Reconciliation reports

---

### Sprint 4: Frontend - Trading UI (Week 7-8)
**Goal**: Build core trading interface

**Tasks**:
- [ ] Enhance trade page layout
- [ ] Build order book component
- [ ] Create order placement panel
- [ ] Implement trade history display
- [ ] Build user orders component
- [ ] Add market selector
- [ ] Integrate with TradingView chart
- [ ] Write component tests

**Deliverables**:
- Functional trading UI
- Order placement flow
- Real-time updates (polling)

---

### Sprint 5: Frontend - Wallet Integration (Week 9-10)
**Goal**: Integrate wallet with DEX features

**Tasks**:
- [ ] Build storage account creation flow
- [ ] Create permission management UI
- [ ] Implement deposit modal
- [ ] Build withdrawal modal
- [ ] Add emergency self-withdraw button
- [ ] Create balance reconciliation view
- [ ] Implement Keeta SDK in frontend
- [ ] Write integration tests

**Deliverables**:
- Complete wallet-DEX integration
- Storage account management
- Emergency exit functionality

---

### Sprint 6: WebSocket & Real-time (Week 11-12)
**Goal**: Add real-time updates via WebSocket

**Tasks**:
- [ ] Implement WebSocket server (Actix)
- [ ] Build pub/sub system (Redis)
- [ ] Create WebSocket client hook
- [ ] Add real-time order book updates
- [ ] Implement live trade feed
- [ ] Add order status updates
- [ ] Create balance change notifications
- [ ] Load test WebSocket connections

**Deliverables**:
- Real-time order book
- Live trade feed
- Instant order updates

---

### Sprint 7: Security & Testing (Week 13-14)
**Goal**: Security audit and comprehensive testing

**Tasks**:
- [ ] ACL permission testing
- [ ] Self-withdraw flow testing
- [ ] Reconciliation accuracy testing
- [ ] Load testing (order throughput)
- [ ] WebSocket stress testing
- [ ] Security audit (permissions, auth)
- [ ] Penetration testing
- [ ] Fix identified issues

**Deliverables**:
- Security audit report
- Load test results
- Bug fixes

---

### Sprint 8: LP Features (Week 15-16)
**Goal**: Add liquidity provider support

**Tasks**:
- [ ] Build LP registration flow
- [ ] Create market maker API
- [ ] Implement fee tier system
- [ ] Build LP dashboard
- [ ] Add performance analytics
- [ ] Create LP documentation
- [ ] Write LP integration tests

**Deliverables**:
- LP onboarding flow
- Market maker tools
- LP analytics dashboard

---

## Phase 7: Database Schema

### PostgreSQL Schema

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_key TEXT UNIQUE NOT NULL,
    storage_account TEXT,
    role TEXT NOT NULL DEFAULT 'user', -- 'user', 'lp', 'admin'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_pubkey ON users(public_key);
CREATE INDEX idx_users_storage ON users(storage_account);

-- Balances
CREATE TABLE balances (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    available NUMERIC(36,0) NOT NULL DEFAULT 0,
    total NUMERIC(36,0) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, token),
    CONSTRAINT check_available CHECK (available >= 0),
    CONSTRAINT check_total CHECK (total >= 0),
    CONSTRAINT check_available_lte_total CHECK (available <= total)
);

CREATE INDEX idx_balances_user ON balances(user_id);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    order_type TEXT NOT NULL CHECK (order_type IN ('limit', 'market')),
    price NUMERIC(36,18),
    quantity NUMERIC(36,18) NOT NULL,
    filled_quantity NUMERIC(36,18) NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('resting', 'partially_filled', 'filled', 'canceled', 'rejected')),
    time_in_force TEXT CHECK (time_in_force IN ('gtc', 'ioc', 'fok', 'postonly')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT check_quantity CHECK (quantity > 0),
    CONSTRAINT check_filled CHECK (filled_quantity >= 0 AND filled_quantity <= quantity),
    CONSTRAINT check_price CHECK (order_type = 'market' OR price > 0)
);

CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_market ON orders(market, status);
CREATE INDEX idx_orders_status ON orders(status);

-- Fills/Trades
CREATE TABLE fills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market TEXT NOT NULL,
    bid_order_id UUID NOT NULL REFERENCES orders(id),
    ask_order_id UUID NOT NULL REFERENCES orders(id),
    bid_user_id UUID NOT NULL REFERENCES users(id),
    ask_user_id UUID NOT NULL REFERENCES users(id),
    price NUMERIC(36,18) NOT NULL,
    quantity NUMERIC(36,18) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fills_market ON fills(market, created_at DESC);
CREATE INDEX idx_fills_bid_user ON fills(bid_user_id);
CREATE INDEX idx_fills_ask_user ON fills(ask_user_id);
CREATE INDEX idx_fills_orders ON fills(bid_order_id, ask_order_id);

-- Deposits
CREATE TABLE deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    amount NUMERIC(36,0) NOT NULL,
    tx_hash TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'credited')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMP,
    credited_at TIMESTAMP
);

CREATE INDEX idx_deposits_user ON deposits(user_id);
CREATE INDEX idx_deposits_tx ON deposits(tx_hash);
CREATE INDEX idx_deposits_status ON deposits(status);

-- Withdrawals
CREATE TABLE withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    amount NUMERIC(36,0) NOT NULL,
    destination TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'canceled')),
    tx_hash TEXT,
    error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_withdrawals_user ON withdrawals(user_id, created_at DESC);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
CREATE INDEX idx_withdrawals_tx ON withdrawals(tx_hash);

-- Reconciliation records
CREATE TABLE reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token TEXT NOT NULL,
    on_chain_balance NUMERIC(36,0) NOT NULL,
    internal_balance NUMERIC(36,0) NOT NULL,
    difference NUMERIC(36,0) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ok', 'drift', 'critical')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reconciliations_user ON reconciliations(user_id, created_at DESC);
CREATE INDEX idx_reconciliations_status ON reconciliations(status, created_at DESC);

-- Audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    metadata JSONB,
    ip_address INET,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_log(action, created_at DESC);
```

---

## Phase 8: Security Considerations

### 8.1 Key Security Features

✅ **Non-Custodial Design**
- Users are always OWNER of their storage accounts
- Exchange cannot lock user funds
- Emergency self-withdraw always available

✅ **Scoped Permissions**
- `SEND_ON_BEHALF` limited to specific tokens
- Operator cannot send arbitrary tokens
- Per-token permission granularity

✅ **Emergency Exit**
- User can revoke all operator permissions
- Self-withdraw using OWNER privileges
- Bypasses exchange backend entirely

✅ **Continuous Reconciliation**
- Every 5 minutes compare on-chain vs internal
- Alert on any drift
- Auto-correct small discrepancies

✅ **Operator Key Security**
- Hot wallet for day-to-day operations
- Cold wallet for large settlements
- Multi-sig for critical operations

---

### 8.2 Attack Mitigations

#### Operator Key Compromise
**Risk**: Attacker gains access to operator private key

**Mitigation**:
1. Permissions are scoped per token
2. User can revoke ACL entries instantly
3. Most-specific permissions win (hierarchical)
4. Hot wallet has limited token access
5. Cold wallet requires multi-sig

**Response**:
```typescript
// User revokes compromised operator
await storageManager.revokeOperatorPermissions(
  storageAccount,
  compromisedOperatorPubkey
);

// User self-withdraws all funds
for (const token of tokens) {
  await storageManager.selfWithdraw(
    storageAccount,
    userWalletAddress,
    token,
    balance
  );
}
```

---

#### Backend Failure
**Risk**: Exchange backend goes offline

**User Impact**: ✅ **NONE** - Users can always self-withdraw

**Flow**:
```typescript
// User bypasses backend entirely
const storageManager = new StorageAccountManager(userClient);

// Direct on-chain withdrawal
await storageManager.selfWithdraw(
  storageAccount,
  destinationAddress,
  token,
  amount
);
```

---

#### Balance Drift
**Risk**: Internal ledger doesn't match on-chain state

**Detection**:
- Reconciliation worker runs every 5 minutes
- Compares fully consistent on-chain reads
- Flags discrepancies immediately

**Correction**:
```rust
// Auto-correct small drift
if diff.abs() < DUST_THRESHOLD {
    ledger.adjust_balance(user, token, diff);
    audit_log("auto_corrected_drift", user, token, diff);
}

// Flag large drift for manual review
if diff.abs() > LARGE_THRESHOLD {
    alert_admins("critical_drift", user, token, diff);
    freeze_account(user); // Prevent further trades
}
```

---

#### Double Spend
**Risk**: User attempts to withdraw more than available balance

**Mitigation**:
1. Internal ledger tracks available vs total
2. Reserve balance on order placement
3. Debit available on withdrawal request
4. Keeta validates on-chain balance at settlement
5. Optimistic concurrency control catches conflicts

**Flow**:
```rust
// Reserve balance for order
ledger.reserve(user, token, amount); // available -= amount

// If insufficient:
if !reserve_success {
    return Err("Insufficient balance");
}

// On withdrawal:
ledger.debit_available(user, token, amount); // available -= amount

// On settlement (Keeta validates):
keeta.send_on_behalf(storage, dest, token, amount);
// If fails (insufficient on-chain), credit back:
ledger.credit_available(user, token, amount);
```

---

#### Front-Running
**Risk**: Operator sees user orders before execution

**Mitigation**:
1. Orders executed in timestamp order (price-time priority)
2. Operator has no special order placement privileges
3. All fills audited and logged
4. User can verify fill prices against order book history

**Audit**:
```sql
-- Verify fill price matches order book at timestamp
SELECT f.price, o.price, f.created_at
FROM fills f
JOIN orders o ON o.id = f.bid_order_id
WHERE f.price != o.price; -- Should be empty
```

---

### 8.3 Security Checklist

Before production deployment:

- [ ] Operator keys secured (hot/cold split)
- [ ] Multi-sig implemented for cold wallet
- [ ] Rate limiting on all API endpoints
- [ ] DDoS protection (Cloudflare/AWS Shield)
- [ ] Database encryption at rest
- [ ] TLS/SSL for all connections
- [ ] JWT expiry and rotation
- [ ] Input validation (Zod schemas)
- [ ] SQL injection prevention (parameterized queries)
- [ ] CORS properly configured
- [ ] Audit logging enabled
- [ ] Reconciliation worker running
- [ ] Alert system configured
- [ ] Emergency shutdown procedure documented
- [ ] Incident response plan ready
- [ ] Security audit completed
- [ ] Penetration testing done
- [ ] Bug bounty program live

---

## Technology Stack Summary

### Backend Stack
```
Language: Rust 1.70+
Framework: Actix-web 4
Database: PostgreSQL 15
Cache: Redis 7
WebSocket: actix-web-actors
Auth: JWT (jsonwebtoken)
Decimals: rust_decimal
Deployment: Docker + Docker Compose
```

### Frontend Stack
```
Language: TypeScript 5
Framework: Next.js 14 (App Router)
UI: React 18
Styling: Tailwind CSS
Icons: Lucide React
Validation: Zod
State: React Context + Hooks
WebSocket: Native WebSocket API
```

### Keeta Integration
```
SDK: @keetanetwork/keetanet-client
Network: Keeta Test Network
Features:
  - Native tokenization
  - Storage accounts
  - ACL permissions
  - SEND_ON_BEHALF delegation
  - Fully consistent reads
  - 400ms settlement
  - 10M TPS capacity
```

### Development Tools
```
Build: Bun (frontend), Cargo (backend)
Linting: ESLint, Clippy
Formatting: Prettier, rustfmt
Testing: Jest, cargo test
API Docs: OpenAPI/Swagger
Monitoring: Prometheus + Grafana
Logging: env_logger, Winston
```

---

## References

### Design Documents
- [`keeta_backend_actix_rust.md`](./Keeta%20CEX%20Design/keeta_backend_actix_rust.md) - Backend architecture
- [`keeta_cex_internal_book_design.md`](./Keeta%20CEX%20Design/keeta_cex_internal_book_design.md) - CLOB design
- [`keeta_client_ts.md`](./Keeta%20CEX%20Design/keeta_client_ts.md) - Client SDK
- [`keeta_backend_docker_compose.md`](./Keeta%20CEX%20Design/keeta_backend_docker_compose.md) - Deployment

### Keeta Documentation
- **Keeta Docs**: https://docs.keeta.com/
- **Storage Accounts**: https://docs.keeta.com/components/accounts/storage-accounts
- **Permissions**: https://docs.keeta.com/components/accounts/permissions
- **Native Tokenization**: https://docs.keeta.com/features/native-tokenization
- **Settlement (400ms)**: https://docs.keeta.com/introduction
- **Keeta SDK**: https://static.test.keeta.com/docs/

### Additional Resources
- [AGENTS.md](./AGENTS.md) - Development guidelines
- [README.md](./README.md) - Project overview
- Keeta Whitepaper - Architecture details

---

## Next Steps

To begin implementation:

1. **Review this plan** with the team
2. **Choose starting phase** (recommended: Phase 1 - Backend)
3. **Set up development environment**
   - Install Rust, PostgreSQL, Redis
   - Clone Keeta SDK
   - Configure test network access
4. **Create backend project structure**
5. **Implement Sprint 1 tasks**

---

**Document Version**: 1.0  
**Last Updated**: October 11, 2024  
**Status**: Ready for Implementation  
**Estimated Timeline**: 16 weeks (4 months)

---


