export type OrderSide = 'buy' | 'sell';
export type OrderType = 'limit' | 'market';
export type TimeInForce = 'gtc' | 'ioc' | 'fok';

export interface OrderBookEntry {
  price: number;
  quantity: number;
  total?: number;
}

export interface OrderBookSnapshot {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

export interface TradeHistoryEntry {
  id: string;
  market: string;
  price: number;
  quantity: number;
  side: OrderSide;
  timestamp: number;
}

export type OrderStatus =
  | 'resting'
  | 'partially_filled'
  | 'filled'
  | 'canceled'
  | 'expired'
  | 'rejected'
  | string;

export interface UserOrderEntry {
  id: string;
  market: string;
  side: OrderSide;
  price: number;
  quantity: number;
  filledQuantity: number;
  status: OrderStatus;
  createdAt?: number;
  updatedAt?: number;
}

export interface OrderRequestPayload {
  market: string;
  side: OrderSide;
  price: string;
  quantity: string;
  type: OrderType;
  timeInForce?: TimeInForce;
}

export interface ApiLimitOrderPayload {
  user_id: string;
  market: string;
  side: OrderSide;
  price: string;
  quantity: string;
  tif?: TimeInForce;
}

export interface ApiWithdrawRequest {
  user_id: string;
  token: string;
  amount: string;
  to: string;
}

export interface ApiDepositAddressResponse {
  storage_account: string;
}

export interface ApiBalanceEntry {
  token: string;
  available: string;
  total: string;
  on_chain: string;
  drift: string;
  status: string;
  last_reconciled_at?: string;
}
