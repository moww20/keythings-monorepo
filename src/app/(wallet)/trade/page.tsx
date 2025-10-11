'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import TradingViewChart from '../../components/TradingViewChart';
import OrderBook from '../../components/OrderBook';
import RFQOrderPanel from '../../components/RFQOrderPanel';
import MarketDataHeader from '../../components/MarketDataHeader';
import MarketTrades from '../../components/MarketTrades';

interface TradingPair {
  base: string;
  quote: string;
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  volume24hQuote: number;
}

export default function TradePage(): React.JSX.Element {
  const { isUnlocked, isDisconnected } = useWallet();
  const [selectedPair, setSelectedPair] = useState<TradingPair>({
    base: 'KTA',
    quote: 'USDT',
    symbol: 'KTA/USDT',
    price: 0.0892,
    change24h: -0.0064,
    changePercent24h: -7.18,
    high24h: 0.0956,
    low24h: 0.0828,
    volume24h: 1840526.66,
    volume24hQuote: 164230.45,
  });

  const [activeTab, setActiveTab] = useState<'chart' | 'info' | 'trading-data' | 'analysis' | 'square'>('chart');
  const [timeframe, setTimeframe] = useState<'1s' | '15m' | '1H' | '4H' | '1D' | '1W'>('1D');

  // Mock order book data for KTA/USDT
  const [orderBookData, setOrderBookData] = useState({
    bids: [
      { price: 0.08920, amount: 558.50, total: 49.82 },
      { price: 0.08915, amount: 1234.50, total: 110.05 },
      { price: 0.08910, amount: 2345.60, total: 209.01 },
      { price: 0.08905, amount: 3456.70, total: 307.80 },
      { price: 0.08900, amount: 4567.80, total: 406.53 },
      { price: 0.08895, amount: 5678.90, total: 505.14 },
      { price: 0.08890, amount: 6789.00, total: 603.56 },
      { price: 0.08885, amount: 7890.10, total: 701.08 },
      { price: 0.08880, amount: 8901.20, total: 790.43 },
      { price: 0.08875, amount: 9012.30, total: 799.84 },
    ],
    asks: [
      { price: 0.08925, amount: 211.00, total: 18.83 },
      { price: 0.08930, amount: 1234.50, total: 110.24 },
      { price: 0.08935, amount: 2345.60, total: 209.55 },
      { price: 0.08940, amount: 3456.70, total: 309.03 },
      { price: 0.08945, amount: 4567.80, total: 408.49 },
      { price: 0.08950, amount: 5678.90, total: 508.26 },
      { price: 0.08955, amount: 6789.00, total: 607.92 },
      { price: 0.08960, amount: 7890.10, total: 706.95 },
      { price: 0.08965, amount: 8901.20, total: 798.02 },
      { price: 0.08970, amount: 9012.30, total: 808.40 },
    ],
  });

  if (isDisconnected) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4">
            <svg className="h-16 w-16 text-muted mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Wallet Not Connected</h2>
          <p className="text-muted mb-4">Please connect your wallet to access trading features.</p>
        </div>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4">
            <svg className="h-16 w-16 text-muted mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Wallet Locked</h2>
          <p className="text-muted mb-4">Please unlock your wallet to access trading features.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Market Data Header */}
      <MarketDataHeader 
        pair={selectedPair}
        onPairChange={setSelectedPair}
      />

      {/* Main Trading Interface */}
      <div className="flex-1 flex gap-2 min-h-0">
        {/* Left Panel - Order Book and Market Trades */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-2">
          {/* Order Book */}
          <div className="flex-1 glass rounded-lg border border-hairline p-3 flex flex-col">
            <OrderBook data={orderBookData} />
          </div>
          
          {/* Market Trades */}
          <div className="flex-1 glass rounded-lg border border-hairline p-3 flex flex-col">
            <MarketTrades pair={selectedPair} />
          </div>
        </div>

        {/* Right Panel - Chart and Order Panel */}
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {/* Chart Panel */}
          <div className="flex-1 glass rounded-lg border border-hairline p-3 flex flex-col min-h-0 min-h-[400px]">
            {/* Chart Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('chart')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'chart'
                        ? 'bg-accent text-white'
                        : 'text-muted hover:text-foreground hover:bg-surface'
                    }`}
                  >
                    Chart
                  </button>
                  <button
                    onClick={() => setActiveTab('info')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'info'
                        ? 'bg-accent text-white'
                        : 'text-muted hover:text-foreground hover:bg-surface'
                    }`}
                  >
                    Info
                  </button>
                  <button
                    onClick={() => setActiveTab('trading-data')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'trading-data'
                        ? 'bg-accent text-white'
                        : 'text-muted hover:text-foreground hover:bg-surface'
                    }`}
                  >
                    Trading Data
                  </button>
                  <button
                    onClick={() => setActiveTab('analysis')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'analysis'
                        ? 'bg-accent text-white'
                        : 'text-muted hover:text-foreground hover:bg-surface'
                    }`}
                  >
                    Trading Analysis
                  </button>
                  <button
                    onClick={() => setActiveTab('square')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'square'
                        ? 'bg-accent text-white'
                        : 'text-muted hover:text-foreground hover:bg-surface'
                    }`}
                  >
                    Square
                  </button>
                </div>
              </div>

              {/* Timeframe Selector */}
              <div className="flex items-center gap-1">
                {(['1s', '15m', '1H', '4H', '1D', '1W'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                      timeframe === tf
                        ? 'bg-accent text-white'
                        : 'text-muted hover:text-foreground hover:bg-surface'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart Content */}
            <div className="flex-1 min-h-0">
              {activeTab === 'chart' ? (
                <TradingViewChart 
                  symbol={selectedPair.symbol}
                  timeframe={timeframe}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-muted">
                  <div className="text-center">
                    <p className="text-lg font-medium">{activeTab.replace('-', ' ')}</p>
                    <p className="text-sm">Coming soon...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order Panel - Below Chart */}
          <div className="glass rounded-lg border border-hairline p-2">
            <RFQOrderPanel 
              pair={selectedPair}
              onOrderSubmit={(order) => {
                console.log('Order submitted:', order);
                // TODO: Handle order submission
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
