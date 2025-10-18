'use client';

import { useMemo } from 'react';

export interface TradingPairInfo {
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

export interface TradingPairSelectorProps {
  selected?: string | null;
  onChange: (pair: string) => void;
  pairs?: TradingPairInfo[];
}

export const DEFAULT_TRADING_PAIRS: TradingPairInfo[] = [
  {
    base: 'KTA',
    quote: 'BASE',
    symbol: 'KTA/BASE',
    price: 0.3994,
    change24h: 0.0265,
    changePercent24h: 7.10,
    high24h: 0.42,
    low24h: 0.37,
    volume24h: 5508599.30,
    volume24hQuote: 2200000.0,
  },
];

export function TradingPairSelector({
  selected,
  onChange,
  pairs = DEFAULT_TRADING_PAIRS,
}: TradingPairSelectorProps): React.JSX.Element {
  const selectedPair = useMemo(() => {
    if (pairs.length === 0) {
      return undefined;
    }
    if (!selected) {
      return pairs[0];
    }
    return pairs.find((pair) => pair.symbol === selected) ?? pairs[0];
  }, [pairs, selected]);

  const formatPrice = (price: number) => {
    if (price >= 1000) {
      return price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    if (price >= 1) {
      return price.toFixed(4);
    }

    return price.toFixed(6);
  };

  const formatChange = (value: number) => {
    const formatted = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    const color = value >= 0 ? 'text-green-400' : 'text-red-400';
    return { formatted, color };
  };

  if (!selectedPair || pairs.length === 0) {
    return (
      <div className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-muted">
        No RFQ markets available yet. Makers can publish the first quote.
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2">
        {pairs.map((pairInfo) => {
          const isActive = pairInfo.symbol === selectedPair.symbol;
          const change = formatChange(pairInfo.changePercent24h);
          return (
            <button
              key={pairInfo.symbol}
              type="button"
              onClick={() => onChange(pairInfo.symbol)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-left transition-colors ${
                isActive ? 'bg-accent/15 text-foreground border border-accent/50' : 'bg-surface-strong text-muted hover:text-foreground'
              }`}
              aria-pressed={isActive}
            >
              <div>
                <div className="text-sm font-semibold text-foreground">{pairInfo.symbol}</div>
                <div className="text-[11px] text-muted">{pairInfo.base} · {pairInfo.quote}</div>
              </div>
              <div className="ml-2 text-right">
                <div className="text-sm font-semibold text-foreground">${formatPrice(pairInfo.price)}</div>
                <div className={`text-[11px] font-semibold ${change.color}`}>{change.formatted}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TradingPairSelector;
