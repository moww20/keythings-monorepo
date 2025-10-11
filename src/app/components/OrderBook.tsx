'use client';

import { useMemo } from 'react';

import type { OrderBookEntry, OrderBookSnapshot } from '@/app/types/trading';

interface OrderBookProps {
  data?: OrderBookSnapshot;
  precision?: number;
  className?: string;
}

const FALLBACK_LEVELS: OrderBookEntry[] = [
  { price: 0.0892, quantity: 558.5 },
  { price: 0.08915, quantity: 1234.5 },
  { price: 0.0891, quantity: 2345.6 },
  { price: 0.08905, quantity: 3456.7 },
  { price: 0.089, quantity: 4567.8 },
  { price: 0.08895, quantity: 5678.9 },
  { price: 0.0889, quantity: 6789.0 },
  { price: 0.08885, quantity: 7890.1 },
  { price: 0.0888, quantity: 8901.2 },
  { price: 0.08875, quantity: 9012.3 },
];

function normalizeLevels(levels?: OrderBookEntry[]): OrderBookEntry[] {
  if (!levels?.length) {
    return FALLBACK_LEVELS;
  }

  const normalized = levels
    .map((level) => {
      const price = Number(level.price);
      const quantity = Number(level.quantity);
      if (!Number.isFinite(price) || !Number.isFinite(quantity)) {
        return null;
      }
      return { price, quantity };
    })
    .filter((level): level is OrderBookEntry => Boolean(level));

  return normalized.length ? normalized : FALLBACK_LEVELS;
}

function accumulate(levels: OrderBookEntry[]): OrderBookEntry[] {
  let runningTotal = 0;
  return levels.map((level) => {
    runningTotal += level.quantity;
    return { ...level, total: runningTotal };
  });
}

function formatPrice(value: number, precision: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

function formatQuantity(value: number) {
  if (value >= 1) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return value.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function formatTotal(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toFixed(2);
}

export function OrderBook({ data, precision = 5, className }: OrderBookProps): React.JSX.Element {
  const processed = useMemo(() => {
    const bids = accumulate(normalizeLevels(data?.bids)).slice(0, 12);
    const asks = accumulate(normalizeLevels(data?.asks)).slice(0, 12);
    const maxTotal = Math.max(
      bids.reduce((max, level) => Math.max(max, level.total ?? 0), 0),
      asks.reduce((max, level) => Math.max(max, level.total ?? 0), 0),
      1,
    );

    return {
      bids,
      asks,
      maxTotal,
      bestBid: bids[0]?.price ?? null,
      bestAsk: asks[0]?.price ?? null,
    };
  }, [data]);

  const midPrice = useMemo(() => {
    if (processed.bestBid && processed.bestAsk) {
      return (processed.bestBid + processed.bestAsk) / 2;
    }
    return null;
  }, [processed.bestAsk, processed.bestBid]);

  return (
    <div className={`flex h-full flex-col ${className ?? ''}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Order Book</h3>
        <div className="rounded border border-hairline px-2 py-1 text-xs text-muted">
          Depth {precision}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-1 text-xs font-medium text-muted">
        <span className="text-right">Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Total</span>
      </div>

      <div className="mt-1 flex-1 overflow-hidden">
        <div className="flex h-full flex-col gap-1">
          <div className="space-y-0.5">
            {processed.asks.map((level, index) => {
              const depth = Math.min(100, ((level.total ?? 0) / processed.maxTotal) * 100);
              return (
                <div key={`ask-${index}`} className="relative overflow-hidden rounded">
                  <div
                    className="absolute inset-y-0 right-0 bg-red-500/10"
                    style={{ width: `${depth}%` }}
                    aria-hidden="true"
                  />
                  <div className="relative grid grid-cols-3 gap-2 px-1 py-0.5 text-xs font-mono transition-colors">
                    <span className="text-right text-red-400">{formatPrice(level.price, precision)}</span>
                    <span className="text-right text-foreground">{formatQuantity(level.quantity)}</span>
                    <span className="text-right text-muted">{formatTotal(level.total ?? 0)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="my-2 flex flex-col items-center rounded border border-hairline px-3 py-2 text-center">
            <span className="text-sm font-semibold text-foreground">
              {midPrice ? `$${midPrice.toFixed(precision)}` : '—'}
            </span>
            <span className="text-xs text-muted">Mid Price</span>
          </div>

          <div className="space-y-0.5">
            {processed.bids.map((level, index) => {
              const depth = Math.min(100, ((level.total ?? 0) / processed.maxTotal) * 100);
              return (
                <div key={`bid-${index}`} className="relative overflow-hidden rounded">
                  <div
                    className="absolute inset-y-0 left-0 bg-green-500/10"
                    style={{ width: `${depth}%` }}
                    aria-hidden="true"
                  />
                  <div className="relative grid grid-cols-3 gap-2 px-1 py-0.5 text-xs font-mono transition-colors">
                    <span className="text-right text-green-400">{formatPrice(level.price, precision)}</span>
                    <span className="text-right text-foreground">{formatQuantity(level.quantity)}</span>
                    <span className="text-right text-muted">{formatTotal(level.total ?? 0)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderBook;
