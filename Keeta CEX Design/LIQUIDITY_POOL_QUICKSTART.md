# Liquidity Pool Quick Start Guide

> **CLOB + AMM + Smart Router** - Get started with the Keeta hybrid exchange in 5 minutes

---

## Overview

### 🎯 Three-Engine Architecture

The Keeta CEX combines **three powerful liquidity mechanisms**:

#### 1. 📊 **CLOB (Central Limit Order Book)**
- Professional market makers
- Tight spreads and deep liquidity
- Price-time priority matching
- Best for popular pairs and large trades

#### 2. 💱 **AMM (Automated Market Maker)**
- Always-available liquidity pools
- Instant execution (no order matching delay)
- Passive income for LPs (0.24% of swap fees)
- Best for tail assets and quick swaps

#### 3. 🤖 **Smart Router**
- Automatically analyzes both CLOB and AMM
- Routes each order to the best venue
- Can split orders for optimal execution
- Transparent best execution guarantee

### Key Benefits

- ✅ **Best Execution** - Router finds optimal price automatically
- ✅ **Deep Liquidity** - Two venues provide better fills
- ✅ **Always Available** - AMM never sleeps, CLOB for pros
- ✅ **Passive Income** - LPs earn fees, MMs earn spreads
- ✅ **Non-Custodial** - Your keys, your funds (Keeta storage accounts)

---

## Architecture Summary

```
                   📱 User Submits Order
                          ↓
              ┌───────────────────────┐
              │   🤖 SMART ROUTER     │
              │  (Intelligent Routing)│
              └───────────┬───────────┘
                          │
          ┌───────────────┴───────────────┐
          ↓                               ↓
    ┌─────────────┐              ┌─────────────┐
    │ 📊 CLOB     │              │ 💱 AMM      │
    │ Order Book  │              │ Liquidity   │
    │             │              │ Pools       │
    │ • Limit     │              │ • Constant  │
    │ • Market    │              │ • Stable    │
    │ • Stop      │              │ • Weighted  │
    └─────────────┘              └─────────────┘
          ↓                               ↓
    ┌─────────────────────────────────────────┐
    │      Internal Ledger (Off-Chain)        │
    │   Tracks balances, reserves, orders     │
    └─────────────────────────────────────────┘
                          ↓
    ┌─────────────────────────────────────────┐
    │      Keeta Network (On-Chain)           │
    │  • Settlement in 400ms                  │
    │  • Non-custodial storage accounts       │
    │  • Native token support                 │
    └─────────────────────────────────────────┘
```

**Key Components:**
1. **Smart Router** - Analyzes CLOB + AMM, routes for best execution
2. **CLOB Engine** - Matches limit/market orders, professional MM support
3. **Pool Manager** - Creates and manages AMM liquidity pools
4. **Liquidity Pools** - Hold reserves, execute instant swaps
5. **LP Tokens** - Represent pool ownership shares
6. **Internal Ledger** - Fast off-chain balance tracking
7. **Keeta Network** - Decentralized settlement layer

---

## API Endpoints

### Base URL: `http://localhost:8080/api`

### 1. List All Pools

**GET** `/pools/list`

**Response:**
```json
{
  "pools": [
    {
      "id": "USDT-USDX",
      "token_a": "USDT",
      "token_b": "USDX",
      "reserve_a": "1000000",
      "reserve_b": "1000000",
      "lp_token": "LP-USDT-USDX",
      "total_lp_supply": "999000",
      "fee_rate": "0.003",
      "pool_type": "constant_product",
      "storage_account": "S_pool_USDT_USDX"
    }
  ]
}
```

### 2. Get Pool Details

**GET** `/pools/:pool_id`

**Example:** `/pools/USDT-USDX`

### 3. Create New Pool

**POST** `/pools/create`

**Request:**
```json
{
  "token_a": "USDT",
  "token_b": "USDX",
  "initial_amount_a": "1000000",
  "initial_amount_b": "1000000",
  "fee_rate": 30,
  "pool_type": "constant_product"
}
```

**Response:**
```json
{
  "pool_id": "USDT-USDX",
  "storage_account": "S_pool_USDT_USDX",
  "lp_token": "LP-USDT-USDX",
  "lp_tokens_minted": "999000"
}
```

### 4. Add Liquidity

**POST** `/pools/add-liquidity`

**Request:**
```json
{
  "pool_id": "USDT-USDX",
  "amount_a_desired": "100000",
  "amount_b_desired": "100000",
  "amount_a_min": "99000",
  "amount_b_min": "99000"
}
```

**Response:**
```json
{
  "amount_a": "100000",
  "amount_b": "100000",
  "lp_tokens": "99900",
  "share_of_pool": "9.0991%"
}
```

### 5. Remove Liquidity

**POST** `/pools/remove-liquidity`

**Request:**
```json
{
  "pool_id": "USDT-USDX",
  "lp_tokens": "50000",
  "amount_a_min": "49000",
  "amount_b_min": "49000"
}
```

**Response:**
```json
{
  "amount_a": "50050",
  "amount_b": "50050",
  "fees_earned_a": "50",
  "fees_earned_b": "50"
}
```

### 6. Swap Tokens

**POST** `/pools/swap`

**Request:**
```json
{
  "pool_id": "USDT-USDX",
  "token_in": "USDT",
  "amount_in": "1000",
  "min_amount_out": "990"
}
```

**Response:**
```json
{
  "amount_in": "1000",
  "amount_out": "997",
  "fee": "3",
  "price_impact": "0.10%",
  "execution_price": "0.997000"
}
```

### 7. Get Swap Quote

**POST** `/pools/quote`

**Request:**
```json
{
  "pool_id": "USDT-USDX",
  "token_in": "USDT",
  "amount_in": "1000"
}
```

**Response:**
```json
{
  "amount_out": "997",
  "fee": "3",
  "price_impact": "0.10%",
  "minimum_received": "992",
  "route": "pool"
}
```

---

## Pool Types

### 1. Constant Product (x * y = k)

**Best For:** General token pairs (USDT/KTA, KTA/ETH)

**Characteristics:**
- Industry standard (Uniswap V2)
- Simple and reliable
- 0.3% fee (20% to protocol, 80% to LPs)

**Usage:**
```json
{
  "pool_type": "constant_product"
}
```

### 2. Stable Swap (Curve-style)

**Best For:** Stablecoin pairs (USDT/USDX, USDC/DAI)

**Characteristics:**
- Low slippage for similar-priced assets
- ~8x more capital efficient
- Best for 1:1 pegged assets

**Usage:**
```json
{
  "pool_type": "stable_swap"
}
```

### 3. Weighted Pool (Balancer-style)

**Best For:** Custom exposure ratios

**Characteristics:**
- Customizable weights (e.g., 80/20)
- Lower impermanent loss for unbalanced pairs
- Good for index tokens

**Usage:**
```json
{
  "pool_type": "weighted"
}
```

---

## Testing the Pool System

### Step 1: Start the Backend

```bash
cd keythings-dapp-engine
cargo run
```

Backend will start on `http://localhost:8080`

### Step 2: Create a Test Pool

```bash
curl -X POST http://localhost:8080/api/pools/create \
  -H "Content-Type: application/json" \
  -d '{
    "token_a": "USDT",
    "token_b": "USDX",
    "initial_amount_a": "1000000",
    "initial_amount_b": "1000000",
    "fee_rate": 30,
    "pool_type": "constant_product"
  }'
```

### Step 3: Add Liquidity

```bash
curl -X POST http://localhost:8080/api/pools/add-liquidity \
  -H "Content-Type: application/json" \
  -d '{
    "pool_id": "USDT-USDX",
    "amount_a_desired": "100000",
    "amount_b_desired": "100000"
  }'
```

### Step 4: Get Swap Quote

```bash
curl -X POST http://localhost:8080/api/pools/quote \
  -H "Content-Type: application/json" \
  -d '{
    "pool_id": "USDT-USDX",
    "token_in": "USDT",
    "amount_in": "1000"
  }'
```

### Step 5: Execute Swap

```bash
curl -X POST http://localhost:8080/api/pools/swap \
  -H "Content-Type: application/json" \
  -d '{
    "pool_id": "USDT-USDX",
    "token_in": "USDT",
    "amount_in": "1000",
    "min_amount_out": "990"
  }'
```

### Step 6: List All Pools

```bash
curl http://localhost:8080/api/pools/list
```

---

## How the Smart Router Works

### Automatic Best Execution

Every order goes through the Smart Router, which intelligently determines the optimal execution venue:

**Step 1: Analyze Both Venues**
```
CLOB Analysis:
- Check order book depth
- Calculate best bid/ask
- Simulate market order execution
- Estimate slippage

AMM Analysis:
- Calculate pool output amount
- Compute price impact
- Factor in 0.3% fee
- Check liquidity depth
```

**Step 2: Compare Execution Quality**
```typescript
if (clobPrice > ammPrice + 0.1%) {
  route = "CLOB"  // Order book is >0.1% better
} else if (ammPrice > clobPrice + 0.1%) {
  route = "AMM"   // Pool is >0.1% better
} else {
  route = "SPLIT" // Similar prices, split for best fill
}
```

**Step 3: Execute Transparently**
- User gets best price automatically
- No manual venue selection needed
- Execution details shown in response
- Route logged for transparency

### Routing Strategies by Order Size

**Small Orders (<$1,000):**
- ✅ Route to **AMM** (instant execution, minimal gas)
- ⚠️ Skip CLOB (order matching overhead not worth it)

**Medium Orders ($1,000 - $50,000):**
- ✅ Route to **best venue** (CLOB or AMM)
- 🔀 May **split** if prices are close

**Large Orders (>$50,000):**
- ✅ Route to **CLOB** (deeper liquidity, less slippage)
- 🔀 **Split** recommended (reduce market impact)

**Example: $10,000 USDT → USDX Swap**
```
Smart Router Analysis:
- CLOB: 9,995 USDX (0.05% slippage)
- AMM:  9,970 USDX (0.30% slippage)

Decision: Route to CLOB ✅
Execution: Market order on order book
Result: User gets 9,995 USDX (best execution)
```

### Frontend Integration

**Add Pool Swap UI:**
```typescript
// src/app/components/PoolSwapPanel.tsx
import { useState } from 'react';

export function PoolSwapPanel() {
  const [tokenIn, setTokenIn] = useState('USDT');
  const [tokenOut, setTokenOut] = useState('USDX');
  const [amountIn, setAmountIn] = useState('');
  const [quote, setQuote] = useState(null);
  
  async function getQuote() {
    const res = await fetch('/api/pools/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pool_id: `${tokenIn}-${tokenOut}`,
        token_in: tokenIn,
        amount_in: amountIn,
      }),
    });
    
    const data = await res.json();
    setQuote(data);
  }
  
  async function executeSwap() {
    await fetch('/api/pools/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pool_id: `${tokenIn}-${tokenOut}`,
        token_in: tokenIn,
        amount_in: amountIn,
        min_amount_out: quote.minimum_received,
      }),
    });
  }
  
  return (
    <div className="glass p-6 rounded-lg">
      <h3 className="text-xl font-semibold mb-4">Swap via Pool</h3>
      
      {/* Token inputs */}
      <input
        type="number"
        value={amountIn}
        onChange={(e) => setAmountIn(e.target.value)}
        onBlur={getQuote}
        placeholder="Amount"
      />
      
      {/* Quote display */}
      {quote && (
        <div>
          <p>You'll receive: {quote.amount_out} {tokenOut}</p>
          <p>Price impact: {quote.price_impact}</p>
        </div>
      )}
      
      {/* Swap button */}
      <button onClick={executeSwap}>
        Swap
      </button>
    </div>
  );
}
```

---

## Fee Structure

**Trading Fees:**
- 0.3% per swap (30 basis points)
- 80% to liquidity providers (0.24%)
- 20% to protocol treasury (0.06%)

**LP Rewards:**
- Fees accrue automatically to pool reserves
- LP token value increases over time
- Withdraw anytime (non-custodial)

**Example:**
```
Pool has $1M TVL
Daily volume: $100K
Daily fees: $300 (0.3% of $100K)
LP share: $240 (80%)
Annual fees: $87,600
Annual APY: 8.76%
```

---

## Safety Features

✅ **Minimum Liquidity Lock** - First 1000 LP tokens burned to prevent inflation attacks  
✅ **Slippage Protection** - User-defined minimum output amounts  
✅ **Price Impact Limits** - Prevent excessive slippage (>5% warning)  
✅ **Reentrancy Guards** - Atomic swap execution  
✅ **Emergency Pause** - Admin can pause pools in emergency  
✅ **On-Chain Reconciliation** - Continuous balance verification

---

## Monitoring & Analytics

### Pool Health Metrics

**Key Indicators:**
- TVL (Total Value Locked)
- 24h Volume
- APY (Annual Percentage Yield)
- Price Impact Curves
- Utilization Rate

**Example Response:**
```json
{
  "pool": {
    "id": "USDT-USDX",
    "tvl_usd": "2000000",
    "volume_24h": "500000",
    "fees_24h": "1500",
    "apy": "24.5%",
    "lp_count": 142
  }
}
```

---

## Troubleshooting

### Common Issues

**1. "Insufficient liquidity"**
- Pool reserves too low for swap
- Solution: Add more liquidity or reduce swap amount

**2. "Slippage exceeded"**
- Price moved between quote and execution
- Solution: Increase slippage tolerance

**3. "Insufficient LP tokens"**
- Trying to remove more than owned
- Solution: Check LP token balance first

**4. "Pool paused"**
- Emergency pause activated
- Solution: Wait for admin to unpause

---

## Next Steps

1. ✅ **Review Design Document**: [keeta_liquidity_pool_design.md](./keeta_liquidity_pool_design.md)
2. ⏭️ **Deploy to Testnet**: Test with real Keeta tokens
3. ⏭️ **Add Frontend UI**: Build pool management interface
4. ⏭️ **Launch Initial Pools**: USDT/USDX, KTA/USDT
5. ⏭️ **Enable Hybrid Routing**: Integrate with order book

---

## Support

**Documentation:**
- [Full Design Document](./keeta_liquidity_pool_design.md)
- [Backend Architecture](./keeta_backend_actix_rust.md)
- [DEX Integration Plan](../DEX_INTEGRATION_PLAN.md)

**Issues:**
- Create GitHub issue with `[POOL]` prefix
- Include pool ID and error messages
- Provide request/response examples

---

**Version:** 1.0  
**Last Updated:** October 13, 2024  
**Status:** Ready for Testing

