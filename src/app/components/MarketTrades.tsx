'use client';

import React, { useState } from 'react';

interface Trade {
  price: number;
  amount: number;
  time: string;
  type: 'buy' | 'sell';
}

interface MarketTradesProps {
  pair: {
    base: string;
    quote: string;
  };
}

export default function MarketTrades({ pair }: MarketTradesProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'market' | 'my'>('market');

  // Mock market trades data
  const marketTrades: Trade[] = [
    { price: 0.08920, amount: 558.50, time: '12:50:40', type: 'sell' },
    { price: 0.08925, amount: 1234.50, time: '12:50:39', type: 'buy' },
    { price: 0.08915, amount: 2345.60, time: '12:50:38', type: 'sell' },
    { price: 0.08930, amount: 3456.70, time: '12:50:37', type: 'buy' },
    { price: 0.08910, amount: 4567.80, time: '12:50:36', type: 'sell' },
    { price: 0.08935, amount: 5678.90, time: '12:50:35', type: 'buy' },
    { price: 0.08905, amount: 6789.00, time: '12:50:34', type: 'sell' },
    { price: 0.08940, amount: 7890.10, time: '12:50:33', type: 'buy' },
    { price: 0.08900, amount: 8901.20, time: '12:50:32', type: 'sell' },
    { price: 0.08945, amount: 9012.30, time: '12:50:31', type: 'buy' },
    { price: 0.08895, amount: 10123.40, time: '12:50:30', type: 'sell' },
    { price: 0.08950, amount: 11234.50, time: '12:50:29', type: 'buy' },
    { price: 0.08890, amount: 12345.60, time: '12:50:28', type: 'sell' },
    { price: 0.08955, amount: 13456.70, time: '12:50:27', type: 'buy' },
    { price: 0.08885, amount: 14567.80, time: '12:50:26', type: 'sell' },
  ];

  // Mock my trades data
  const myTrades: Trade[] = [
    { price: 0.08915, amount: 1000.00, time: '12:45:15', type: 'buy' },
    { price: 0.08930, amount: 500.00, time: '12:40:22', type: 'sell' },
    { price: 0.08890, amount: 750.00, time: '12:35:10', type: 'buy' },
    { price: 0.08945, amount: 300.00, time: '12:30:05', type: 'sell' },
  ];

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 5,
      maximumFractionDigits: 5,
    });
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const currentTrades = activeTab === 'market' ? marketTrades : myTrades;

  return (
    <div className="h-full flex flex-col">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('market')}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              activeTab === 'market'
                ? 'text-foreground border-b-2 border-accent'
                : 'text-muted hover:text-foreground'
            }`}
          >
            Market Trades
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              activeTab === 'my'
                ? 'text-foreground border-b-2 border-accent'
                : 'text-muted hover:text-foreground'
            }`}
          >
            My Trades
          </button>
        </div>
        
        {/* Options Menu */}
        <button className="p-1 hover:bg-surface rounded" title="Options menu">
          <svg className="h-4 w-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted mb-2 px-1">
        <div>Price ({pair.quote})</div>
        <div>Amount ({pair.base})</div>
        <div>Time</div>
      </div>

      {/* Trades List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-0.5">
          {currentTrades.map((trade, index) => (
            <div
              key={`${activeTab}-${index}`}
              className="grid grid-cols-3 gap-2 text-xs hover:bg-surface/50 transition-colors px-1 py-1 rounded"
            >
              <div className={`font-mono ${
                trade.type === 'buy' ? 'text-green-400' : 'text-red-400'
              }`}>
                {formatPrice(trade.price)}
              </div>
              <div className="font-mono text-foreground">
                {formatAmount(trade.amount)}
              </div>
              <div className="font-mono text-muted">
                {trade.time}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty State for My Trades */}
      {activeTab === 'my' && myTrades.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-2">
              <svg className="h-8 w-8 text-muted mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm text-muted">No trades yet</p>
            <p className="text-xs text-faint">Your trading history will appear here</p>
          </div>
        </div>
      )}
    </div>
  );
}
