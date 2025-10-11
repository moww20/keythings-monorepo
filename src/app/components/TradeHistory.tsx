'use client';

import { useMemo } from 'react';

import type { TradeHistoryEntry } from '@/app/types/trading';

interface TradeHistoryProps {
  trades?: TradeHistoryEntry[];
  limit?: number;
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatPrice(price: number) {
  if (price >= 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (price >= 1) {
    return price.toFixed(4);
  }
  return price.toFixed(6);
}

function formatQuantity(quantity: number) {
  if (quantity >= 1) {
    return quantity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return quantity.toFixed(4);
}

export function TradeHistory({ trades = [], limit = 40 }: TradeHistoryProps): React.JSX.Element {
  const items = useMemo(() => {
    return trades
      .slice(0, limit)
      .map((trade) => ({
        ...trade,
        price: Number(trade.price),
        quantity: Number(trade.quantity),
        timestamp: Number(trade.timestamp),
      }))
      .filter((trade) => Number.isFinite(trade.price) && Number.isFinite(trade.quantity));
  }, [limit, trades]);

  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">No recent trades yet.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2 px-2 text-xs font-medium text-muted">
        <span>Time</span>
        <span className="text-right">Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Total</span>
      </div>
      <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
        {items.map((trade) => {
          const total = trade.price * trade.quantity;
          const color = trade.side === 'buy' ? 'text-green-400' : 'text-red-400';
          return (
            <div
              key={`${trade.id}-${trade.timestamp}`}
              className="grid grid-cols-4 gap-2 rounded px-2 py-1 text-xs font-mono transition-colors hover:bg-surface"
            >
              <span className="text-muted">{formatTime(trade.timestamp)}</span>
              <span className={`text-right ${color}`}>{formatPrice(trade.price)}</span>
              <span className="text-right text-foreground">{formatQuantity(trade.quantity)}</span>
              <span className="text-right text-muted">{total.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TradeHistory;
