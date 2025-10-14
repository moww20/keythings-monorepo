# Keeta Liquidity Pool Integration Plan
## Architecture: User-Controlled Non-Custodial Design

**Status:** ✅ **MOST SECURE APPROACH SELECTED**

---

## 🔒 **Security Model: User Signs Everything**

### Core Principle

**Backend has ZERO custody. Users sign ALL operations via their wallet.**

```
┌──────────────────────────────────────────┐
│  User Wallet (Keeta Extension)          │
│  - OWNER of all storage accounts        │
│  - Signs every operation                │
│  - Can revoke permissions anytime       │
└──────────────────────────────────────────┘
         ↓ Signs transactions
┌──────────────────────────────────────────┐
│  Frontend (Transaction Builder)         │
│  - Keeta SDK integration                │
│  - Builds unsigned transactions         │
│  - Requests user signature via wallet   │
│  - Submits to Keeta network             │
└──────────────────────────────────────────┘
         ↓ Notifies (not custody)
┌──────────────────────────────────────────┐
│  Backend (Stateless Coordinator)        │
│  - Tracks pool state                    │
│  - Provides quotes and analytics        │
│  - NO operator key                      │
│  - CANNOT move funds                    │
└──────────────────────────────────────────┘
         ↓ Queries (read-only)
┌──────────────────────────────────────────┐
│  Keeta Network (Source of Truth)        │
│  - Actual pool storage accounts         │
│  - Real balances and reserves           │
│  - Transaction history                  │
└──────────────────────────────────────────┘
```

### Security Benefits

✅ **Zero Custody Risk** - Backend never holds keys or funds  
✅ **User Control** - User is OWNER of their storage accounts  
✅ **Explicit Approval** - Every operation requires wallet signature  
✅ **Transparent** - All transactions visible on Keeta explorer  
✅ **Revocable** - User can withdraw/close pools anytime  
✅ **No Operator Key** - Nothing for attackers to steal from backend  

---

## 📋 **Implementation Phases**

### Phase 1: Frontend Transaction Builder (Week 1)

**Goal:** Move all Keeta SDK operations to frontend where user signs.

#### 1.1 Pool Creation (User-Signed)

**File:** `src/app/components/CreatePoolModal.tsx`

```typescript
import { useKeetaWallet } from '../hooks/useKeetaWallet';

async function createPoolOnChain(tokenA, tokenB, amountA, amountB) {
  const { client, walletAddress } = useKeetaWallet();
  
  // STEP 1: Build transaction with Keeta SDK
  const builder = client.initBuilder();
  
  // STEP 2: Generate pool storage account identifier
  const poolStorage = builder.generateIdentifier(STORAGE);
  await builder.computeBlocks();
  
  // STEP 3: Set user as OWNER of pool storage account
  builder.setInfo({
    defaultPermission: new Permissions([
      'STORAGE_DEPOSIT',    // Anyone can deposit
      'STORAGE_CAN_HOLD'    // Can hold specified tokens
    ])
  }, { account: poolStorage.account });
  
  // STEP 4: Transfer initial liquidity from user to pool
  builder.send(poolStorage.account, amountA, tokenA);
  builder.send(poolStorage.account, amountB, tokenB);
  
  // STEP 5: User signs and publishes to Keeta
  const result = await client.publishBuilder(builder);
  
  // STEP 6: Notify backend (for UI/analytics tracking only)
  await fetch('/api/pools/created', {
    method: 'POST',
    body: JSON.stringify({
      pool_id: `${tokenA}-${tokenB}`,
      storage_account: poolStorage.address,
      token_a: tokenA,
      token_b: tokenB,
      initial_a: amountA,
      initial_b: amountB,
      tx_hash: result.txHash,
      creator: walletAddress,
    })
  });
  
  return {
    poolId: `${tokenA}-${tokenB}`,
    storageAccount: poolStorage.address,
    txHash: result.txHash,
  };
}
```

**User Experience:**
```
1. User enters pool parameters
2. User clicks "Create Pool"
3. Wallet prompts: "Sign transaction to create pool?"
4. User approves in wallet extension
5. Transaction submitted to Keeta (400ms settlement)
6. Pool appears in UI with on-chain confirmation
```

#### 1.2 Add Liquidity (User-Signed)

**File:** `src/app/components/AddLiquidityModal.tsx`

```typescript
async function addLiquidityOnChain(poolId, amountA, amountB) {
  const { client } = useKeetaWallet();
  
  // Get pool storage account from backend (read-only query)
  const pool = await fetch(`/api/pools/${poolId}`).then(r => r.json());
  
  // Build transaction
  const builder = client.initBuilder();
  
  // Transfer tokens to pool storage account
  builder.send(pool.storage_account, amountA, pool.token_a);
  builder.send(pool.storage_account, amountB, pool.token_b);
  
  // User signs and publishes
  const result = await client.publishBuilder(builder);
  
  // Notify backend
  await fetch('/api/pools/liquidity-added', {
    method: 'POST',
    body: JSON.stringify({
      pool_id: poolId,
      amount_a: amountA,
      amount_b: amountB,
      tx_hash: result.txHash,
    })
  });
  
  return result;
}
```

#### 1.3 Remove Liquidity (User-Signed)

```typescript
async function removeLiquidityOnChain(poolId, lpTokens) {
  const { client, walletAddress } = useKeetaWallet();
  
  const pool = await fetch(`/api/pools/${poolId}`).then(r => r.json());
  
  // Calculate amounts to withdraw
  const sharePercentage = lpTokens / pool.total_lp_supply;
  const amountA = pool.reserve_a * sharePercentage;
  const amountB = pool.reserve_b * sharePercentage;
  
  // Build transaction to transfer from pool back to user
  const builder = client.initBuilder();
  
  // User is OWNER of pool storage account, so they can withdraw
  builder.send(walletAddress, amountA, pool.token_a, {
    from: pool.storage_account
  });
  builder.send(walletAddress, amountB, pool.token_b, {
    from: pool.storage_account
  });
  
  // User signs and publishes
  const result = await client.publishBuilder(builder);
  
  // Notify backend
  await fetch('/api/pools/liquidity-removed', {
    method: 'POST',
    body: JSON.stringify({
      pool_id: poolId,
      lp_tokens: lpTokens,
      amount_a: amountA,
      amount_b: amountB,
      tx_hash: result.txHash,
    })
  });
  
  return result;
}
```

---

### Phase 2: Backend as Stateless Coordinator (Week 2)

**Goal:** Simplify backend to track state and provide quotes. NO custody, NO signing.

#### 2.1 Update Pool API to Be Read-Only

**File:** `keythings-dapp-engine/src/pool_api.rs`

```rust
// BEFORE (Backend creates storage accounts - WRONG)
pub async fn create_pool(...) -> HttpResponse {
    let storage_account = state.keeta_client.create_pool_storage_account(...).await?;
    // ❌ Backend creates account = Backend custody
}

// AFTER (Backend just tracks user-created pools - CORRECT)
pub async fn notify_pool_created(
    state: web::Data<PoolState>,
    body: web::Json<PoolCreatedNotification>,
) -> HttpResponse {
    // User already created pool on-chain
    // Backend just updates internal tracking for UI
    
    let pool = LiquidityPool {
        id: body.pool_id.clone(),
        token_a: body.token_a.clone(),
        token_b: body.token_b.clone(),
        reserve_a: body.initial_a,
        reserve_b: body.initial_b,
        storage_account: body.storage_account.clone(),
        creator: body.creator.clone(),
        created_at: Utc::now(),
        // NO operator key involved
    };
    
    state.pool_manager.register_pool(pool);
    
    HttpResponse::Ok().json(json!({
        "status": "tracked",
        "pool_id": body.pool_id
    }))
}

// Provide quotes (read-only)
pub async fn quote_swap(
    state: web::Data<PoolState>,
    body: web::Json<QuoteRequest>,
) -> HttpResponse {
    let pool = state.pool_manager.get_pool(&body.pool_id)?;
    
    // Calculate output (pure math, no custody)
    let amount_out = pool.calculate_amount_out(body.amount_in, &body.token_in)?;
    
    HttpResponse::Ok().json(QuoteResponse {
        amount_out,
        price_impact: pool.calculate_price_impact(body.amount_in),
        // This is just a quote - user executes on-chain
    })
}
```

#### 2.2 Remove Operator Key Dependencies

**File:** `keythings-dapp-engine/src/keeta.rs`

```rust
// REMOVE all methods that require operator key:
// ❌ create_pool_storage_account (user does this)
// ❌ setup_pool_acl (user does this)
// ❌ send_on_behalf (not needed)

// KEEP only read-only methods:
impl KeetaClient {
    // ✅ Query on-chain balance (read-only)
    pub async fn query_balance(&self, account: &str, token: &str) -> Result<u64> {
        // Query Keeta RPC for balance
    }
    
    // ✅ Verify transaction (read-only)
    pub async fn verify_transaction(&self, tx_hash: &str) -> Result<TxStatus> {
        // Query Keeta for tx confirmation
    }
    
    // ✅ Get storage account info (read-only)
    pub async fn get_storage_account(&self, address: &str) -> Result<StorageAccountInfo> {
        // Query Keeta for account details
    }
}
```

**Result:** Backend has ZERO ability to move funds. All custody with users.

---

### Phase 3: Reconciliation (Query-Only) (Week 3)

**Goal:** Backend queries Keeta to keep UI in sync, but CANNOT modify on-chain state.

#### 3.1 Read-Only Reconciliation

**File:** `keythings-dapp-engine/src/reconcile.rs`

```rust
impl Reconciler {
    pub async fn reconcile_pool(&self, pool_id: &str) -> Result<ReconcileReport> {
        let pool = self.pool_manager.get_pool(pool_id)?;
        
        // Query actual on-chain balances (read-only)
        let on_chain_a = self.keeta_client
            .query_balance(&pool.storage_account, &pool.token_a)
            .await?;
        let on_chain_b = self.keeta_client
            .query_balance(&pool.storage_account, &pool.token_b)
            .await?;
        
        // Compare with internal tracking
        let drift_a = (on_chain_a as i64) - (pool.reserve_a as i64);
        let drift_b = (on_chain_b as i64) - (pool.reserve_b as i64);
        
        if drift_a != 0 || drift_b != 0 {
            log::warn!(
                "Pool {} drift detected (UI out of sync): a={}, b={}",
                pool_id, drift_a, drift_b
            );
            
            // Update internal tracking to match chain (source of truth)
            self.pool_manager.update_reserves(
                pool_id,
                on_chain_a,
                on_chain_b,
            )?;
        }
        
        Ok(ReconcileReport {
            pool_id: pool_id.to_string(),
            drift_a,
            drift_b,
            on_chain_a,
            on_chain_b,
            // Backend CANNOT fix drift - only user can by signing txs
        })
    }
}
```

**Key Point:** Reconciliation updates backend's internal tracking, NOT the blockchain.

---

### Phase 4: Swap Execution (User-Signed) (Week 4)

**Goal:** User signs swap transactions directly, backend provides quotes.

#### 4.1 Frontend Swap Builder

**File:** `src/app/(wallet)/trade/page.tsx`

```typescript
async function executeSwapOnChain(poolId, tokenIn, amountIn) {
  const { client, walletAddress } = useKeetaWallet();
  
  // Get quote from backend (read-only)
  const quote = await fetch('/api/pools/quote', {
    method: 'POST',
    body: JSON.stringify({ pool_id: poolId, token_in: tokenIn, amount_in: amountIn })
  }).then(r => r.json());
  
  const pool = await fetch(`/api/pools/${poolId}`).then(r => r.json());
  
  // Build swap transaction
  const builder = client.initBuilder();
  
  // Transfer token_in to pool
  builder.send(pool.storage_account, amountIn, tokenIn);
  
  // Transfer token_out from pool to user (user is OWNER)
  builder.send(walletAddress, quote.amount_out, quote.token_out, {
    from: pool.storage_account
  });
  
  // User signs and executes
  const result = await client.publishBuilder(builder);
  
  // Notify backend for analytics
  await fetch('/api/pools/swap-executed', {
    method: 'POST',
    body: JSON.stringify({
      pool_id: poolId,
      token_in: tokenIn,
      token_out: quote.token_out,
      amount_in: amountIn,
      amount_out: quote.amount_out,
      tx_hash: result.txHash,
      user: walletAddress,
    })
  });
  
  return result;
}
```

---

## ✅ **Success Criteria**

### Security
- ✅ Backend has NO operator key
- ✅ Backend CANNOT move funds
- ✅ Users are OWNER of all storage accounts
- ✅ All operations require user wallet signature
- ✅ Zero custody risk

### Functionality
- ✅ Users can create pools (sign in wallet)
- ✅ Users can add liquidity (sign in wallet)
- ✅ Users can remove liquidity (sign in wallet)
- ✅ Users can swap via pools (sign in wallet)
- ✅ Backend provides accurate quotes
- ✅ UI shows real-time on-chain state

### User Experience
- ✅ Clear wallet prompts for every operation
- ✅ Transaction status visible in UI
- ✅ Keeta explorer links for verification
- ✅ Fast settlement (400ms Keeta confirmation)

---

## 🎯 **Current Implementation Phase**

**PHASE 1: Frontend Transaction Builder** ⏳ IN PROGRESS

**Next Steps:**
1. ✅ Update CreatePoolModal to build transactions client-side
2. ⏳ Add Keeta SDK transaction builder helpers
3. ⏳ Implement wallet signature requests
4. ⏳ Update backend to notification-only endpoints

---

## 🔐 **Why This Is The Most Secure**

| Aspect | User-Controlled (Our Approach) | Operator-Controlled |
|--------|--------------------------------|---------------------|
| **Custody** | User maintains OWNER | Operator has custody |
| **Attack Vector** | Must compromise user's wallet | Compromise backend = steal all funds |
| **Key Management** | User's wallet (secure enclave) | Backend env vars (vulnerable) |
| **Transparency** | All txs on Keeta explorer | Internal settlement opaque |
| **Revocability** | User can withdraw anytime | Must request from operator |
| **Blast Radius** | One user at a time | All users at once |

**Verdict:** User-controlled is objectively more secure. No single point of failure.

---

## 📚 **Documentation Updates Needed**

- [ ] Update AGENTS.md with non-custodial architecture
- [ ] Add user signing guide to README
- [ ] Document transaction building patterns
- [ ] Create security audit document highlighting zero-custody design

---

**Last Updated:** 2025-10-14  
**Architecture:** User-Controlled Non-Custodial  
**Status:** Phase 1 In Progress

