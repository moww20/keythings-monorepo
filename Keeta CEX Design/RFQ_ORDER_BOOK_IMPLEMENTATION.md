# RFQ Order Book Implementation Plan

## Overview

This document outlines the implementation of a Request for Quote (RFQ) order book system for the Keeta CEX, enabling peer-to-peer atomic swaps without liquidity pools using Keeta's native `send`/`receive` operations.

## Executive Summary

The RFQ system transforms the current AMM pool-based swap mechanism into a true peer-to-peer trading system where:
- **Market Makers** post orders with unsigned atomic swap transactions
- **Takers** browse the order book and fill orders by signing counterparty transactions
- **Settlement** occurs directly between users via Keeta's atomic swap mechanism
- **No intermediaries** or pool storage accounts required

## Architecture Comparison

### Current (AMM Pool) Architecture
```
User A → Pool Storage Account → User B
       ↑                     ↑
   Liquidity Provider    Liquidity Provider
```

### New (RFQ Order Book) Architecture
```
User A (Maker) ←→ User B (Taker)
     ↑              ↑
  Posts Order    Fills Order
  (unsigned)     (signs & publishes)
```

## Key Implementation Components

### 1. Backend Order Book System (Rust)

#### Order Data Structure
```rust
pub struct RFQOrder {
    pub id: String,
    pub maker_address: String,
    pub taker_address: Option<String>, // Optional: specific taker or open order
    pub token_sell: String,
    pub amount_sell: String,
    pub token_buy: String,
    pub amount_buy: String,
    pub price: String, // amount_buy / amount_sell
    pub unsigned_block: String, // Base64 encoded block bytes
    pub status: OrderStatus, // 'open' | 'filled' | 'cancelled' | 'expired'
    pub created_at: String,
    pub expires_at: String,
    pub filled_at: Option<String>,
    pub tx_signature: Option<String>,
}

pub enum OrderStatus {
    Open,
    Filled,
    Cancelled,
    Expired,
}
```

#### Order Book Manager
```rust
pub struct OrderBook {
    orders: Arc<DashMap<String, RFQOrder>>,
    bids: Arc<DashMap<String, Vec<String>>>, // token_pair -> order_ids (sorted by price)
    asks: Arc<DashMap<String, Vec<String>>>, // token_pair -> order_ids (sorted by price)
}

impl OrderBook {
    pub fn post_order(&self, order: RFQOrder) -> Result<String, OrderBookError>;
    pub fn list_orders(&self, token_pair: Option<&str>) -> Vec<RFQOrder>;
    pub fn fill_order(&self, order_id: &str, taker_address: &str) -> Result<RFQOrder, OrderBookError>;
    pub fn cancel_order(&self, order_id: &str, maker_address: &str) -> Result<(), OrderBookError>;
    pub fn expire_orders(&self) -> Vec<String>; // Returns expired order IDs
}
```

### 2. API Endpoints (Rust/Actix-web)

```rust
// Order Management
POST   /api/rfq/orders/create     // Maker posts new order
GET    /api/rfq/orders            // List available orders (filterable by token pair)
GET    /api/rfq/orders/:id        // Get specific order details
POST   /api/rfq/orders/:id/fill   // Taker fills order (provides signature)
DELETE /api/rfq/orders/:id/cancel // Maker cancels order
POST   /api/rfq/orders/:id/settle // Finalize swap after both signatures

// Order Book Data
GET    /api/rfq/orderbook/:pair   // Get order book for specific token pair
GET    /api/rfq/orderbook         // Get all order books
```

### 3. Frontend RFQ Implementation (TypeScript/React)

#### Atomic Swap Flow
```typescript
// MAKER SIDE (Create Order):
const builder = client.initBuilder();
const takerAddress = KeetaNet.lib.Account.fromPublicKeyString('<taker-address>');
const tokenSell = KeetaNet.lib.Account.fromPublicKeyString('<token-sell>');
const tokenBuy = KeetaNet.lib.Account.fromPublicKeyString('<token-buy>');

builder.send(takerAddress, amountSell, tokenSell);
builder.receive(takerAddress, amountBuy, tokenBuy, true);

// Compute but DON'T publish
const {blocks} = await client.computeBuilderBlocks(builder);
const unsignedBytes = blocks[0].toBytes();

// Store in order book
POST /api/rfq/orders/create { unsignedBytes, ... }

// TAKER SIDE (Fill Order):
// Retrieve unsigned block from order book
GET /api/rfq/orders/:id → { unsignedBytes }

// Taker signs and publishes
const block = Block.fromBytes(unsignedBytes);
await client.publishBuilder(builder); // Taker signature finalizes swap
```

#### New Components
- **`RFQOrderBook.tsx`** - Display bid/ask orders with maker addresses
- **`CreateRFQOrderModal.tsx`** - Form for posting limit orders
- **`RFQOrderPanel.tsx`** - Order placement interface for RFQ
- **`RFQSwapExecutor.ts`** - Core atomic swap execution logic

### 4. Type Definitions

```typescript
interface RFQOrder {
  id: string;
  maker_address: string;
  taker_address?: string;
  token_sell: string;
  amount_sell: string;
  token_buy: string;
  amount_buy: string;
  price: string;
  unsigned_block: string;
  status: 'open' | 'filled' | 'cancelled' | 'expired';
  created_at: string;
  expires_at: string;
  filled_at?: string;
  tx_signature?: string;
}

interface OrderBookState {
  orders: RFQOrder[];
  bids: RFQOrder[]; // Buy orders sorted by price (highest first)
  asks: RFQOrder[]; // Sell orders sorted by price (lowest first)
  spread: string;
  mid_price: string;
}
```

## Integration with Existing Trade Page

### Enhanced Trade Page Layout
```
┌─────────────────────────────────────────────────────────┐
│ Trading Pair: USDT/KTA                    [Traditional] [RFQ] │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │   Chart     │ │   Order Book     │ │   Order Panel   │ │
│ │             │ │                 │ │                 │ │
│ │             │ │ Traditional:    │ │ Mode: [RFQ]     │ │
│ │             │ │ • 1.002 (500)   │ │                 │ │
│ │             │ │ • 1.001 (300)   │ │ Token Sell:     │ │
│ │             │ │                 │ │ Amount: 100     │ │
│ │             │ │ RFQ Orders:      │ │ Token Buy:      │ │
│ │             │ │ • 1.003 (200)   │ │ Amount: 100.3   │ │
│ │             │ │ • 1.004 (150)   │ │ Expiry: 1h      │ │
│ │             │ │                 │ │                 │ │
│ │             │ │                 │ │ [Create RFQ]    │ │
│ └─────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Trade Page Enhancements
1. **Mode Toggle** - Switch between Traditional and RFQ trading
2. **Unified Order Book** - Display both order types with visual distinction
3. **Dual Order Panels** - Traditional limit orders + RFQ atomic swaps
4. **Real-time Updates** - WebSocket integration for both order types

## Security Considerations

### 1. Order Validation
- Verify maker has sufficient balance before accepting order
- Validate unsigned block structure and token addresses
- Ensure expiry times are reasonable (max 24 hours)
- Check for duplicate orders and prevent spam

### 2. Front-Running Prevention
- Implement order queue with timestamps
- Add maker/taker protection periods (30 seconds)
- Rate limit order creation (max 10 orders per minute per user)
- Use commit-reveal schemes for large orders

### 3. Signature Verification
- Validate both maker and taker signatures
- Ensure unsigned block matches order parameters
- Prevent signature replay attacks
- Verify transaction structure before settlement

### 4. Order Book Integrity
- Automatically expire old orders (cleanup every 5 minutes)
- Clean up filled/cancelled orders
- Prevent duplicate order IDs
- Monitor for suspicious activity patterns

## Implementation Phases

### Phase 1: Backend Infrastructure (Week 1-2)
- [ ] Create `order_book.rs` with Order struct and OrderBook manager
- [ ] Create `order_api.rs` with REST endpoints for CRUD operations
- [ ] Update `main.rs` to register order API routes
- [ ] Add RFQ types to `models.rs`
- [ ] Implement order validation and security checks

### Phase 2: Frontend RFQ Components (Week 2-3)
- [ ] Create `RFQOrderBook.tsx` component for order display
- [ ] Create `CreateRFQOrderModal.tsx` for order creation
- [ ] Create `RFQSwapExecutor.ts` for atomic swap logic
- [ ] Add RFQ types to `trading.ts`
- [ ] Create `useRFQOrderBook.ts` hook for API interactions

### Phase 3: Trade Page Integration (Week 3-4)
- [ ] Update trade page to support RFQ mode toggle
- [ ] Integrate RFQ components with existing order book
- [ ] Add WebSocket support for RFQ order updates
- [ ] Implement real-time order book updates
- [ ] Add visual distinction between order types

### Phase 4: Testing & Security (Week 4-5)
- [ ] Create E2E tests for full RFQ flow
- [ ] Implement security audit checklist
- [ ] Add order book integrity monitoring
- [ ] Performance testing with high order volume
- [ ] User acceptance testing

## Success Criteria

- ✅ Users can create RFQ orders without pools
- ✅ Users can browse order book with bid/ask spread
- ✅ Users can fill orders via atomic swaps
- ✅ Orders expire automatically
- ✅ Real-time order book updates via WebSocket
- ✅ No pool storage accounts required
- ✅ Direct peer-to-peer settlement using Keeta's send/receive operations
- ✅ 400ms settlement time on Keeta network
- ✅ Non-custodial architecture maintained

## Keeta Alignment Verification

- ✅ **Uses Keeta's atomic swap mechanism**: `send()` + `receive()` operations
- ✅ **Follows Keeta patterns**: Unsigned blocks for counterparty signature
- ✅ **Non-custodial**: Users maintain full custody, backend just coordinates
- ✅ **400ms settlement**: Leverages Keeta's fast settlement
- ✅ **No intermediaries**: Direct peer-to-peer swaps
- ✅ **Regulatory compliance**: Built-in compliance protocols supported

## Files to Create/Modify

### Backend (Rust)
- `keythings-dapp-engine/src/order_book.rs` (new)
- `keythings-dapp-engine/src/order_api.rs` (new)
- `keythings-dapp-engine/src/main.rs` (update)
- `keythings-dapp-engine/src/models.rs` (update - add RFQ types)

### Frontend (TypeScript/React)
- `src/app/(wallet)/trade/page.tsx` (update - add RFQ mode)
- `src/app/components/RFQOrderBook.tsx` (new)
- `src/app/components/CreateRFQOrderModal.tsx` (new)
- `src/app/components/RFQOrderPanel.tsx` (new)
- `src/app/lib/RFQSwapExecutor.ts` (new)
- `src/app/types/trading.ts` (update - add RFQ types)
- `src/app/hooks/useRFQOrderBook.ts` (new)

## Testing Strategy

### Unit Tests
- Order creation and validation logic
- Order matching and expiry handling
- Atomic swap transaction building
- Security validation functions

### Integration Tests
- Full RFQ order lifecycle (create → fill → settle)
- WebSocket real-time updates
- Order book integrity checks
- Error handling and edge cases

### E2E Tests
- Complete user flows for makers and takers
- Concurrent order handling
- Network failure scenarios
- Security attack simulations

## Monitoring & Operations

### Key Metrics
- Order fill rate and average time to fill
- Order book depth and spread analysis
- Settlement success rate and timing
- User activity and order patterns

### Alerting
- Order book integrity violations
- Failed settlement attempts
- Suspicious trading patterns
- System performance degradation

### Maintenance
- Regular order book cleanup
- Performance optimization
- Security updates
- User feedback integration

---

This RFQ implementation plan provides a comprehensive roadmap for transforming the Keeta CEX into a true peer-to-peer trading platform while maintaining the security, performance, and regulatory compliance standards required for institutional-grade trading.
