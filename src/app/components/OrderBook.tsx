'use client';

import React from 'react';

interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

interface OrderBookProps {
  data: OrderBookData;
  precision?: number;
}

export default function OrderBook({ data, precision = 2 }: OrderBookProps): React.JSX.Element {
  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 8,
      maximumFractionDigits: 8,
    });
  };

  const formatTotal = (total: number) => {
    if (total >= 1000000) {
      return (total / 1000000).toFixed(2) + 'M';
    } else if (total >= 1000) {
      return (total / 1000).toFixed(2) + 'K';
    }
    return total.toFixed(2);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-foreground">Order Book</h3>
        <select 
          className="bg-surface border border-hairline rounded px-1 py-0.5 text-xs text-foreground"
          aria-label="Price precision selector"
        >
          <option value="0.01">0.01</option>
          <option value="0.1">0.1</option>
          <option value="1">1</option>
          <option value="10">10</option>
        </select>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted mb-1 px-1">
        <div className="text-right">Price</div>
        <div className="text-right">Amount</div>
        <div className="text-right">Total</div>
      </div>

            {/* Asks (Sell Orders) - Show 10 rows */}
            <div className="flex-1 min-h-0">
              <div className="space-y-0.5 mb-1">
                {data.asks.slice(0, 10).map((ask, index) => (
            <div
              key={`ask-${index}`}
              className="grid grid-cols-3 gap-2 text-xs hover:bg-surface/50 transition-colors px-1 py-0.5 rounded"
            >
              <div className="text-right text-red-400 font-mono">
                {formatPrice(ask.price)}
              </div>
              <div className="text-right text-foreground font-mono">
                {formatAmount(ask.amount)}
              </div>
              <div className="text-right text-muted font-mono">
                {formatTotal(ask.total)}
              </div>
            </div>
          ))}
        </div>

        {/* Compact Current Price */}
        <div className="flex items-center justify-center py-2 my-1 border-t border-b border-hairline">
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">
              $112,526.79
            </div>
            <div className="flex items-center justify-center gap-1 text-red-400">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span className="text-xs">-7.18%</span>
            </div>
          </div>
        </div>

            {/* Bids (Buy Orders) - Show 10 rows */}
            <div className="space-y-0.5">
              {data.bids.slice(0, 10).map((bid, index) => (
            <div
              key={`bid-${index}`}
              className="grid grid-cols-3 gap-2 text-xs hover:bg-surface/50 transition-colors px-1 py-0.5 rounded"
            >
              <div className="text-right text-green-400 font-mono">
                {formatPrice(bid.price)}
              </div>
              <div className="text-right text-foreground font-mono">
                {formatAmount(bid.amount)}
              </div>
              <div className="text-right text-muted font-mono">
                {formatTotal(bid.total)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compact Depth Indicator */}
      <div className="mt-2 pt-1 border-t border-hairline">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>B 0.64%</span>
          <span>S 99.35%</span>
        </div>
      </div>
    </div>
  );
}
