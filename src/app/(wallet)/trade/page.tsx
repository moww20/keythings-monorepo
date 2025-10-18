'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';

import { TradingPairSelector } from '@/app/components/TradingPairSelector';
import { TradingViewChart, type TradingViewTimeframe } from '@/app/components/TradingViewChart';
import { useWallet } from '@/app/contexts/WalletContext';
import type { TradingPairInfo } from '@/app/components/TradingPairSelector';
import { RFQProvider } from '@/app/contexts/RFQContext';
import { RFQDepthChart } from '@/app/components/rfq/RFQDepthChart';
import { RFQOrderBook } from '@/app/components/rfq/RFQOrderBook';
import { RFQUnifiedPanel } from '@/app/components/rfq/RFQUnifiedPanel';
import { fetchRfqAvailablePairs } from '@/app/lib/rfq-api';

const TIMEFRAMES: TradingViewTimeframe[] = ['1s', '15m', '1H', '4H', '1D', '1W'];
const MODES = [
  { id: 'rfq_taker', label: 'RFQ Taker' },
  { id: 'rfq_maker', label: 'RFQ Maker' },
  { id: 'rfq_orders', label: 'RFQ Orders' },
] as const;

type TradePageMode = (typeof MODES)[number]['id'];

export default function TradePage(): React.JSX.Element {
  const { isConnected } = useWallet();
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<TradingViewTimeframe>('1D');
  const [mode, setMode] = useState<TradePageMode>('rfq_taker');
  const [ktaPriceData, setKtaPriceData] = useState<{
    usd: number;
    usd_24h_change: number;
    usd_24h_vol: number;
  } | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [availablePairs, setAvailablePairs] = useState<TradingPairInfo[]>([]);

  // Fetch live KTA price data
  useEffect(() => {
    const fetchKtaPrice = async () => {
      if (!window.keeta?.getKtaPrice) return;
      
      try {
        setIsLoadingPrice(true);
        const priceData = await window.keeta.getKtaPrice();
        if (priceData && typeof priceData === 'object' && 'usd' in priceData) {
          const data = priceData as any;
          setKtaPriceData({
            usd: data.usd || 0,
            usd_24h_change: data.usd_24h_change || 0,
            usd_24h_vol: data.usd_24h_vol || 0,
          });
        }
      } catch (error) {
        console.error('Failed to fetch KTA price:', error);
      } finally {
        setIsLoadingPrice(false);
      }
    };

    fetchKtaPrice();
    
    // Set up interval to refresh price data every 30 seconds
    const interval = setInterval(fetchKtaPrice, 30000);
    return () => clearInterval(interval);
  }, []);

  const marketDetails: TradingPairInfo | undefined = useMemo(() => {
    if (!selectedPair) {
      return undefined;
    }

    const currentPair = availablePairs.find((pair) => pair.symbol === selectedPair);
    if (!currentPair) {
      return undefined;
    }

    if (ktaPriceData && currentPair.base.toUpperCase() === 'KTA') {
      return {
        ...currentPair,
        price: ktaPriceData.usd,
        changePercent24h: ktaPriceData.usd_24h_change,
        volume24h: ktaPriceData.usd_24h_vol,
        change24h: (ktaPriceData.usd * ktaPriceData.usd_24h_change) / 100,
      };
    }

    return currentPair;
  }, [selectedPair, availablePairs, ktaPriceData]);

  const handlePairChange = useCallback((symbol: string) => {
    setSelectedPair(symbol);
  }, []);

  const handleModeChange = useCallback((nextMode: TradePageMode) => {
    setMode(nextMode);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPairs = async () => {
      try {
        const pairs = await fetchRfqAvailablePairs();
        if (cancelled) {
          return;
        }

        const nextPairs: TradingPairInfo[] = pairs.map((pairSymbol) => {
          const [base = '', quote = ''] = pairSymbol.split('/');
          return {
            base,
            quote,
            symbol: pairSymbol,
            price: 0,
            change24h: 0,
            changePercent24h: 0,
            high24h: 0,
            low24h: 0,
            volume24h: 0,
            volume24hQuote: 0,
          };
        });

        setAvailablePairs(nextPairs);

        if (nextPairs.length === 0) {
          setSelectedPair(null);
          return;
        }

        if (!selectedPair || !nextPairs.some((pair) => pair.symbol === selectedPair)) {
          setSelectedPair(nextPairs[0].symbol);
        }
      } catch (error) {
        console.warn('[TradePage] Failed to load RFQ pairs', error);
      }
    };
    void loadPairs();
    return () => {
      cancelled = true;
    };
  }, [selectedPair]);



  return (
    <div className="min-h-screen bg-[color:var(--background)] px-6 py-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <section className="relative z-30 rounded-lg border border-hairline bg-surface/70 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
              {availablePairs.length > 0 ? (
                <TradingPairSelector
                  selected={selectedPair ?? availablePairs[0]?.symbol}
                  onChange={handlePairChange}
                  pairs={availablePairs}
                />
              ) : (
                <button
                  type="button"
                  className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-muted"
                >
                  No RFQ markets available yet.
                </button>
              )}
            </div>
            {marketDetails ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                <div className="grid grid-cols-2 gap-4 text-sm text-muted sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide">Last Price</p>
                    <p className="text-sm font-semibold text-foreground">
                      {isLoadingPrice ? (
                        <span className="text-muted">Loading...</span>
                      ) : (
                        `$${marketDetails.price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide">24h Change</p>
                    <p className={`text-sm font-semibold ${marketDetails.changePercent24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {isLoadingPrice ? (
                        <span className="text-muted">Loading...</span>
                      ) : (
                        <>
                          {marketDetails.changePercent24h >= 0 ? '+' : ''}
                          {marketDetails.changePercent24h.toFixed(2)}%
                        </>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide">24h Volume</p>
                    <p className="text-sm font-semibold text-foreground">
                      {isLoadingPrice ? (
                        <span className="text-muted">Loading...</span>
                      ) : (
                        marketDetails.volume24h.toLocaleString('en-US', { maximumFractionDigits: 0 })
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted">
                No market data yet. Publish the first RFQ to activate charts.
              </div>
            )}
          </div>
        </section>

        <RFQProvider pair={selectedPair ?? ''}>
          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-12 lg:col-span-8">
              <div className="grid grid-cols-1 gap-4">
                <div className="glass rounded-lg border border-hairline p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        {selectedPair ? `${selectedPair} RFQ Chart` : 'RFQ Chart'}
                      </h2>
                      <p className="text-xs text-muted">Streaming prices to benchmark maker quotes.</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {TIMEFRAMES.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setTimeframe(value)}
                          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                            timeframe === value
                              ? 'bg-accent text-white'
                              : 'text-muted hover:bg-surface hover:text-foreground'
                          }`}
                          disabled={!selectedPair}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[360px] flex items-center justify-center">
                    {selectedPair ? (
                      <TradingViewChart pair={selectedPair} timeframe={timeframe} className="h-full w-full" />
                    ) : (
                      <span className="text-sm text-muted">Select a market to load the RFQ chart.</span>
                    )}
                  </div>
                </div>
                <RFQDepthChart />
                <div className="glass rounded-lg border border-hairline p-4">
                  {selectedPair ? (
                    <RFQOrderBook onPairChange={handlePairChange} />
                  ) : (
                    <div className="text-sm text-muted text-center">
                      Select a market to view the RFQ order book.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <aside className="col-span-12 lg:col-span-4 flex flex-col gap-4">
              <RFQUnifiedPanel mode={mode} onModeChange={handleModeChange} onPairChange={handlePairChange} />
            </aside>
          </div>
        </RFQProvider>
      </div>
    </div>
  );
}
