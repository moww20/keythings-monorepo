'use client';

import React from 'react';

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

interface MarketDataHeaderProps {
  pair: TradingPair;
  onPairChange: (pair: TradingPair) => void;
}

export default function MarketDataHeader({ pair, onPairChange }: MarketDataHeaderProps): React.JSX.Element {
  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000000) {
      return (volume / 1000000000).toFixed(2) + 'B';
    } else if (volume >= 1000000) {
      return (volume / 1000000).toFixed(2) + 'M';
    } else if (volume >= 1000) {
      return (volume / 1000).toFixed(2) + 'K';
    }
    return volume.toFixed(2);
  };

  const formatChange = (change: number, percent: number) => {
    const isPositive = change >= 0;
    const sign = isPositive ? '+' : '';
    return {
      formatted: `${sign}${formatPrice(Math.abs(change))} (${sign}${Math.abs(percent).toFixed(2)}%)`,
      color: isPositive ? 'text-green-400' : 'text-red-400',
      icon: isPositive ? (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-9.2 9.2M7 7v10h10" />
        </svg>
      ),
    };
  };

  const change = formatChange(pair.change24h, pair.changePercent24h);

  return (
    <div className="mb-2 glass rounded-lg border border-hairline px-4 py-2">
      <div className="flex items-center justify-between">
        {/* Left Side - Trading Pair & Price */}
        <div className="flex items-center gap-6">
          <div>
            <div className="mb-1">
              <h1 className="text-xl font-bold text-foreground">{pair.symbol}</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-foreground">
                ${formatPrice(pair.price)}
              </span>
              <div className={`flex items-center gap-1 ${change.color}`}>
                {change.icon}
                <span className="text-sm font-medium">{change.formatted}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center - 24h Statistics */}
        <div className="flex items-center gap-8">
          <div className="text-center">
            <div className="text-xs text-muted mb-1">24h Chg</div>
            <div className={`text-sm font-medium ${change.color}`}>
              {change.formatted}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-xs text-muted mb-1">24h High</div>
            <div className="text-sm font-medium text-foreground">
              ${formatPrice(pair.high24h)}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-xs text-muted mb-1">24h Low</div>
            <div className="text-sm font-medium text-foreground">
              ${formatPrice(pair.low24h)}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-xs text-muted mb-1">24h Volume({pair.base})</div>
            <div className="text-sm font-medium text-foreground">
              {formatVolume(pair.volume24h)}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-xs text-muted mb-1">24h Volume({pair.quote})</div>
            <div className="text-sm font-medium text-foreground">
              ${formatVolume(pair.volume24hQuote)}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
