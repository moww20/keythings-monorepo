'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';

import { TradingPairSelector, DEFAULT_TRADING_PAIRS } from '@/app/components/TradingPairSelector';
import { TradingViewChart, type TradingViewTimeframe } from '@/app/components/TradingViewChart';
import { useWallet } from '@/app/contexts/WalletContext';
import type { TradingPairInfo } from '@/app/components/TradingPairSelector';
import { RFQProvider } from '@/app/contexts/RFQContext';
import { RFQDepthChart } from '@/app/components/rfq/RFQDepthChart';
import { RFQOrderBook } from '@/app/components/rfq/RFQOrderBook';
import { RFQTakerPanel } from '@/app/components/rfq/RFQTakerPanel';
import { RFQMakerPanel } from '@/app/components/rfq/RFQMakerPanel';

const TIMEFRAMES: TradingViewTimeframe[] = ['1s', '15m', '1H', '4H', '1D', '1W'];
const MODES = [
  { id: 'rfq_taker', label: 'RFQ Taker' },
  { id: 'rfq_maker', label: 'RFQ Maker' },
] as const;

type TradePageMode = (typeof MODES)[number]['id'];

export default function TradePage(): React.JSX.Element {
  const { isConnected } = useWallet();
  const [selectedPair, setSelectedPair] = useState<string>(DEFAULT_TRADING_PAIRS[0].symbol);
  const [timeframe, setTimeframe] = useState<TradingViewTimeframe>('1D');
  const [mode, setMode] = useState<TradePageMode>('rfq_taker');
  const [ktaPriceData, setKtaPriceData] = useState<{
    usd: number;
    usd_24h_change: number;
    usd_24h_vol: number;
  } | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);

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
    const basePair = DEFAULT_TRADING_PAIRS.find((pair) => pair.symbol === selectedPair);
    if (!basePair) return undefined;
    
    // Use live data if available, otherwise fall back to static data
    if (ktaPriceData) {
      return {
        ...basePair,
        price: ktaPriceData.usd,
        changePercent24h: ktaPriceData.usd_24h_change,
        volume24h: ktaPriceData.usd_24h_vol,
        change24h: (ktaPriceData.usd * ktaPriceData.usd_24h_change) / 100,
      };
    }
    
    return basePair;
  }, [selectedPair, ktaPriceData]);

  const handlePairChange = useCallback((symbol: string) => {
    setSelectedPair(symbol);
  }, []);



  return (
    <div className="min-h-screen bg-[color:var(--background)] px-6 py-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        {marketDetails && (
          <section className="relative z-30 rounded-lg border border-hairline bg-surface/70 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
                <TradingPairSelector selected={selectedPair} onChange={handlePairChange} />
              </div>
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
            </div>
          </section>
        )}

        <RFQProvider pair={selectedPair}>
          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-12 lg:col-span-8">
              <div className="grid grid-cols-1 gap-4">
                <div className="glass rounded-lg border border-hairline p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">{selectedPair} RFQ Chart</h2>
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
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[360px]">
                    <TradingViewChart pair={selectedPair} timeframe={timeframe} className="h-full w-full" />
                  </div>
                </div>
                <RFQDepthChart />
                <div className="glass rounded-lg border border-hairline p-4">
                  <RFQOrderBook />
                </div>
              </div>
            </section>

            <aside className="col-span-12 lg:col-span-4 flex flex-col gap-4">
              {mode === 'rfq_maker' ? (
                <RFQMakerPanel mode={mode} onModeChange={setMode} />
              ) : (
                <RFQTakerPanel mode={mode} onModeChange={setMode} />
              )}
            </aside>
          </div>
        </RFQProvider>
      </div>
    </div>
  );
}
