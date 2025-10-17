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
      <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2">
        <div className="text-left">
          <div className="text-sm font-medium text-foreground">KTA MARKET</div>
        </div>
      </div>
    </div>
  );
}

export default TradingPairSelector;
