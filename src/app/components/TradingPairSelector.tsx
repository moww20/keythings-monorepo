'use client';

import React, { useState } from 'react';

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

interface TradingPairSelectorProps {
  selectedPair: TradingPair;
  onPairSelect: (pair: TradingPair) => void;
}

const popularPairs: TradingPair[] = [
  {
    base: 'BTC',
    quote: 'USDT',
    symbol: 'BTC/USDT',
    price: 112526.79,
    change24h: -8705.86,
    changePercent24h: -7.18,
    high24h: 122550.00,
    low24h: 102000.00,
    volume24h: 73840.66,
    volume24hQuote: 8413402510.69,
  },
  {
    base: 'ETH',
    quote: 'USDT',
    symbol: 'ETH/USDT',
    price: 3856.42,
    change24h: -234.56,
    changePercent24h: -5.73,
    high24h: 4091.00,
    low24h: 3622.00,
    volume24h: 89234.12,
    volume24hQuote: 3441234567.89,
  },
  {
    base: 'KTA',
    quote: 'USDT',
    symbol: 'KTA/USDT',
    price: 0.415682,
    change24h: -0.06234,
    changePercent24h: -13.04,
    high24h: 0.477922,
    low24h: 0.353348,
    volume24h: 23567890.12,
    volume24hQuote: 9775819.46,
  },
  {
    base: 'SOL',
    quote: 'USDT',
    symbol: 'SOL/USDT',
    price: 234.56,
    change24h: 12.34,
    changePercent24h: 5.56,
    high24h: 245.78,
    low24h: 222.22,
    volume24h: 45678.90,
    volume24hQuote: 10712345.67,
  },
];

export default function TradingPairSelector({ selectedPair, onPairSelect }: TradingPairSelectorProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPairs = popularPairs.filter(pair =>
    pair.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pair.base.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pair.quote.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatPrice = (price: number) => {
    if (price >= 1000) {
      return price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else if (price >= 1) {
      return price.toFixed(4);
    } else {
      return price.toFixed(6);
    }
  };

  const formatChange = (change: number, percent: number) => {
    const isPositive = change >= 0;
    const sign = isPositive ? '+' : '';
    return {
      formatted: `${sign}${Math.abs(percent).toFixed(2)}%`,
      color: isPositive ? 'text-green-400' : 'text-red-400',
    };
  };

  return (
    <div className="relative">
      {/* Selected Pair Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-surface border border-hairline rounded-lg hover:bg-surface-strong transition-colors"
      >
        <div className="text-left">
          <div className="text-sm font-medium text-foreground">{selectedPair.symbol}</div>
          <div className="text-xs text-muted">${formatPrice(selectedPair.price)}</div>
        </div>
        <svg 
          className={`h-4 w-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-80 glass border border-hairline rounded-lg shadow-lg z-20">
            <div className="p-4">
              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search trading pairs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-background border border-hairline rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>

              {/* Popular Pairs */}
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
                  Popular Pairs
                </h4>
                {filteredPairs.map((pair) => {
                  const change = formatChange(pair.change24h, pair.changePercent24h);
                  const isSelected = pair.symbol === selectedPair.symbol;
                  
                  return (
                    <button
                      key={pair.symbol}
                      onClick={() => {
                        onPairSelect(pair);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-md transition-colors ${
                        isSelected
                          ? 'bg-accent text-white'
                          : 'hover:bg-surface text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <div className="text-sm font-medium">{pair.symbol}</div>
                          <div className="text-xs opacity-75">
                            {pair.base} / {pair.quote}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          ${formatPrice(pair.price)}
                        </div>
                        <div className={`text-xs ${change.color}`}>
                          {change.formatted}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {filteredPairs.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted">No pairs found</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
