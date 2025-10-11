'use client';

import { useMemo } from 'react';

import type { TradeHistoryEntry } from '@/app/types/trading';

interface VirtualizedTradeHistoryProps {
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

export function VirtualizedTradeHistory({ 
  trades = [], 
  limit = 100
}: VirtualizedTradeHistoryProps): React.JSX.Element {
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
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="grid grid-cols-[70px_1fr_1fr_1fr] gap-1 px-2 pb-2 text-xs font-medium text-muted">
        <span className="truncate">Time</span>
        <span className="text-right truncate">Price</span>
        <span className="text-right truncate">Amount</span>
        <span className="text-right truncate">Total</span>
      </div>

      {/* Scrollable List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-0">
          {items.map((trade) => {
            const total = trade.price * trade.quantity;
            const color = trade.side === 'buy' ? 'text-green-400' : 'text-red-400';
            
            return (
              <div
                key={`${trade.id}-${trade.timestamp}`}
                className="grid grid-cols-[70px_1fr_1fr_1fr] gap-1 px-2 py-1 text-xs font-mono transition-colors hover:bg-surface"
              >
                <span className="truncate text-muted" title={formatTime(trade.timestamp)}>
                  {formatTime(trade.timestamp)}
                </span>
                <span className={`text-right truncate ${color}`} title={formatPrice(trade.price)}>
                  {formatPrice(trade.price)}
                </span>
                <span className="text-right truncate text-foreground" title={formatQuantity(trade.quantity)}>
                  {formatQuantity(trade.quantity)}
                </span>
                <span className="text-right truncate text-muted" title={total.toFixed(2)}>
                  {total.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VirtualizedTradeHistory;
