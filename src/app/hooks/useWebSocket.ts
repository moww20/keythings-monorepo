'use client';

import { useEffect, useRef, useState } from 'react';

import { useWallet } from '@/app/contexts/WalletContext';
import type {
  OrderBookEntry,
  OrderBookSnapshot,
  TradeHistoryEntry,
  UserOrderEntry,
} from '@/app/types/trading';

const DEFAULT_WS_URL = process.env.NEXT_PUBLIC_DEX_WS_URL ?? 'ws://localhost:8080/ws/trade';

const FALLBACK_ORDER_BOOK: OrderBookSnapshot = {
  bids: [
    { price: 0.0892, quantity: 558.5 },
    { price: 0.08915, quantity: 1234.5 },
    { price: 0.0891, quantity: 2345.6 },
    { price: 0.08905, quantity: 3456.7 },
    { price: 0.089, quantity: 4567.8 },
    { price: 0.08895, quantity: 5678.9 },
    { price: 0.0889, quantity: 6789 },
    { price: 0.08885, quantity: 7890.1 },
    { price: 0.0888, quantity: 8901.2 },
    { price: 0.08875, quantity: 9012.3 },
  ],
  asks: [
    { price: 0.08925, quantity: 211 },
    { price: 0.0893, quantity: 1234.5 },
    { price: 0.08935, quantity: 2345.6 },
    { price: 0.0894, quantity: 3456.7 },
    { price: 0.08945, quantity: 4567.8 },
    { price: 0.0895, quantity: 5678.9 },
    { price: 0.08955, quantity: 6789 },
    { price: 0.0896, quantity: 7890.1 },
    { price: 0.08965, quantity: 8901.2 },
    { price: 0.0897, quantity: 9012.3 },
  ],
};

const FALLBACK_TRADE_BASE_TIMESTAMP = Date.UTC(2024, 0, 1, 12, 0, 0);

const FALLBACK_TRADES: TradeHistoryEntry[] = Array.from({ length: 20 }, (_, index) => {
  const priceVariation = ((index % 6) - 3) * 0.00005;
  const quantityBase = 240 + index * 18;

  return {
    id: `trade-${index}`,
    market: 'KTA/USDT',
    price: Number((0.089 + priceVariation).toFixed(6)),
    quantity: Number(quantityBase.toFixed(4)),
    side: index % 2 === 0 ? 'buy' : 'sell',
    timestamp: FALLBACK_TRADE_BASE_TIMESTAMP - index * 60_000,
  };
});

const FALLBACK_ORDER_BASE_TIMESTAMP = FALLBACK_TRADE_BASE_TIMESTAMP - 60_000 * 5;

const FALLBACK_ORDERS: UserOrderEntry[] = [
  {
    id: 'order-1',
    market: 'KTA/USDT',
    side: 'buy',
    price: 0.089,
    quantity: 1500,
    filledQuantity: 500,
    status: 'partially_filled',
    createdAt: FALLBACK_ORDER_BASE_TIMESTAMP - 60_000 * 15,
  },
  {
    id: 'order-2',
    market: 'KTA/USDT',
    side: 'sell',
    price: 0.091,
    quantity: 900,
    filledQuantity: 900,
    status: 'filled',
    createdAt: FALLBACK_ORDER_BASE_TIMESTAMP - 60_000 * 45,
  },
];

type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

type RawOrderBookLevel = [string, string] | { price: string | number; quantity: string | number };

type RawOrderBookPayload = {
  bids?: RawOrderBookLevel[];
  asks?: RawOrderBookLevel[];
};

type RawTradePayload = {
  id?: string;
  market?: string;
  price?: string | number;
  quantity?: string | number;
  side?: 'buy' | 'sell';
  timestamp?: number | string;
};

type RawOrderPayload = {
  id?: string;
  market?: string;
  side?: 'buy' | 'sell';
  price?: string | number;
  quantity?: string | number;
  filled_quantity?: string | number;
  status?: string;
  created_at?: number | string;
  updated_at?: number | string;
};

function parseLevel(level: RawOrderBookLevel | undefined): OrderBookEntry | null {
  if (!level) return null;
  if (Array.isArray(level)) {
    const [price, quantity] = level;
    const priceValue = Number(price);
    const quantityValue = Number(quantity);
    if (!Number.isFinite(priceValue) || !Number.isFinite(quantityValue)) return null;
    return { price: priceValue, quantity: quantityValue };
  }

  const priceValue = Number(level.price);
  const quantityValue = Number(level.quantity);
  if (!Number.isFinite(priceValue) || !Number.isFinite(quantityValue)) return null;
  return { price: priceValue, quantity: quantityValue };
}

function parseOrderBook(payload: RawOrderBookPayload | undefined): OrderBookSnapshot {
  if (!payload) return FALLBACK_ORDER_BOOK;
  const bids = (payload.bids ?? []).map(parseLevel).filter((level): level is OrderBookEntry => Boolean(level));
  const asks = (payload.asks ?? []).map(parseLevel).filter((level): level is OrderBookEntry => Boolean(level));
  return {
    bids: bids.length ? bids : FALLBACK_ORDER_BOOK.bids,
    asks: asks.length ? asks : FALLBACK_ORDER_BOOK.asks,
  };
}

function parseTrade(payload: RawTradePayload | undefined): TradeHistoryEntry | null {
  if (!payload?.id) return null;
  const price = Number(payload.price);
  const quantity = Number(payload.quantity);
  const timestamp = typeof payload.timestamp === 'string' ? Number(payload.timestamp) : payload.timestamp;
  if (!Number.isFinite(price) || !Number.isFinite(quantity)) return null;
  return {
    id: payload.id,
    market: payload.market ?? 'unknown',
    price,
    quantity,
    side: payload.side === 'sell' ? 'sell' : 'buy',
    timestamp: Number.isFinite(timestamp) ? Number(timestamp) : Date.now(),
  };
}

function parseOrder(payload: RawOrderPayload | undefined): UserOrderEntry | null {
  if (!payload?.id) return null;
  const price = Number(payload.price);
  const quantity = Number(payload.quantity);
  const filledQuantity = Number(payload.filled_quantity ?? 0);
  if (!Number.isFinite(price) || !Number.isFinite(quantity)) return null;
  return {
    id: payload.id,
    market: payload.market ?? 'unknown',
    side: payload.side === 'sell' ? 'sell' : 'buy',
    price,
    quantity,
    filledQuantity: Number.isFinite(filledQuantity) ? filledQuantity : 0,
    status: payload.status ?? 'resting',
    createdAt:
      typeof payload.created_at === 'string'
        ? Number(payload.created_at)
        : (payload.created_at as number | undefined),
    updatedAt:
      typeof payload.updated_at === 'string'
        ? Number(payload.updated_at)
        : (payload.updated_at as number | undefined),
  };
}

export function useWebSocket(market: string | null | undefined) {
  const { publicKey } = useWallet();
  const [orderBook, setOrderBook] = useState<OrderBookSnapshot>(FALLBACK_ORDER_BOOK);
  const [trades, setTrades] = useState<TradeHistoryEntry[]>(FALLBACK_TRADES);
  const [userOrders, setUserOrders] = useState<UserOrderEntry[]>(FALLBACK_ORDERS);
  const [status, setStatus] = useState<ConnectionState>('idle');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!market) {
      return () => undefined;
    }

    let isMounted = true;
    let socket: WebSocket | null = null;

    try {
      socket = new WebSocket(DEFAULT_WS_URL);
      wsRef.current = socket;
      setStatus('connecting');
    } catch (connectionError) {
      // WebSocket server not available - using fallback data
      console.warn('WebSocket connection unavailable, using fallback data:', connectionError);
      setStatus('error');
      return () => undefined;
    }

    socket.onopen = () => {
      if (!isMounted) return;
      console.log('WebSocket connected to', DEFAULT_WS_URL);
      setStatus('open');
      const channels = [`orderbook:${market}`, `trades:${market}`];
      if (publicKey) {
        channels.push(`orders:${publicKey}`);
      }
      socket?.send(
        JSON.stringify({
          type: 'subscribe',
          channels,
        }),
      );
    };

    socket.onmessage = (event) => {
      if (!isMounted) return;
      try {
        const payload = JSON.parse(event.data as string) as { type?: string; data?: unknown };
        switch (payload.type) {
          case 'orderbook': {
            const parsed = parseOrderBook(payload.data as RawOrderBookPayload | undefined);
            setOrderBook(parsed);
            break;
          }
          case 'trade': {
            const parsed = parseTrade(payload.data as RawTradePayload | undefined);
            if (parsed) {
              setTrades((prev) => {
                const next = [parsed, ...prev];
                return next.slice(0, 200);
              });
            }
            break;
          }
          case 'order_update': {
            const parsed = parseOrder(payload.data as RawOrderPayload | undefined);
            if (parsed) {
              setUserOrders((prev) => {
                const existingIndex = prev.findIndex((order) => order.id === parsed.id);
                if (existingIndex >= 0) {
                  const next = [...prev];
                  next[existingIndex] = parsed;
                  return next;
                }
                return [parsed, ...prev];
              });
            }
            break;
          }
          default:
            break;
        }
      } catch (messageError) {
        console.error('Failed to process WebSocket message', messageError);
      }
    };

    socket.onerror = () => {
      if (!isMounted) return;
      // Silently handle WebSocket errors - using fallback data
      // This prevents console spam when WebSocket server is not available
      setStatus('error');
    };

    socket.onclose = (event) => {
      if (!isMounted) return;
      // Only log close events if the connection was previously established
      if (wsRef.current && event.code !== 1000) {
        console.log('WebSocket connection closed unexpectedly:', event.code, event.reason);
      }
      setStatus('closed');
    };

    return () => {
      isMounted = false;
      setStatus('idle');
      try {
        socket?.close();
      } catch (closeError) {
        console.warn('Error closing WebSocket', closeError);
      }
      wsRef.current = null;
    };
  }, [market, publicKey]);

  return { orderBook, trades, userOrders, status };
}
