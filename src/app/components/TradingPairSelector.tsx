'use client';

import { useMemo, useState } from 'react';

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
  selected: string;
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
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPairs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return pairs;
    return pairs.filter((pair) =>
      pair.symbol.toLowerCase().includes(term) ||
      pair.base.toLowerCase().includes(term) ||
      pair.quote.toLowerCase().includes(term),
    );
  }, [pairs, searchTerm]);

  const selectedPair = useMemo(() => {
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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 transition-colors hover:bg-surface-strong"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="text-left">
          <div className="text-sm font-medium text-foreground">{selectedPair?.symbol}</div>
          <div className="text-xs text-muted">${formatPrice(selectedPair?.price ?? 0)}</div>
        </div>
        <svg
          className={`h-4 w-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />
          <div className="absolute top-full left-0 z-50 mt-2 w-80 rounded-lg border border-hairline bg-background shadow-xl">
            <div className="p-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">
                Search Markets
              </label>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search trading pairs"
                aria-label="Search trading pairs"
                className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>

            <div className="max-h-80 space-y-1 overflow-y-auto px-4 pb-4" role="listbox">
              <div className="text-xs font-medium uppercase tracking-wide text-muted">Popular Markets</div>
              {filteredPairs.map((pair) => {
                const change = formatChange(pair.changePercent24h);
                const isActive = pair.symbol === selected;
                return (
                  <button
                    key={pair.symbol}
                    type="button"
                    onClick={() => {
                      onChange(pair.symbol);
                      setIsOpen(false);
                    }}
                    className={`w-full rounded-md px-3 py-2 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:bg-surface-strong/80 ${
                      isActive
                        ? 'bg-surface-strong text-foreground'
                        : 'text-foreground hover:bg-surface-strong/80'
                    }`}
                    role="option"
                    aria-selected={isActive}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{pair.symbol}</span>
                      <span className={`text-xs font-semibold ${change.color}`}>{change.formatted}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted">
                      <span>${formatPrice(pair.price)}</span>
                      <span>Vol {pair.volume24h.toLocaleString()}</span>
                    </div>
                  </button>
                );
              })}

              {filteredPairs.length === 0 && (
                <p className="py-6 text-center text-xs text-muted">No markets match your search.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TradingPairSelector;
