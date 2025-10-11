'use client';

import { useCallback, useMemo, useState } from 'react';

import { TradingPairSelector, DEFAULT_TRADING_PAIRS } from '@/app/components/TradingPairSelector';
import { TradingViewChart, type TradingViewTimeframe } from '@/app/components/TradingViewChart';
import { OrderBook } from '@/app/components/OrderBook';
import { OrderPanel, type OrderParams } from '@/app/components/OrderPanel';
import { TradeHistory } from '@/app/components/TradeHistory';
import { UserOrders } from '@/app/components/UserOrders';
import { useWallet } from '@/app/contexts/WalletContext';
import { useDexApi } from '@/app/hooks/useDexApi';
import { useWebSocket } from '@/app/hooks/useWebSocket';
import type { TradingPairInfo } from '@/app/components/TradingPairSelector';

const TIMEFRAMES: TradingViewTimeframe[] = ['1s', '15m', '1H', '4H', '1D', '1W'];

export default function TradePage(): React.JSX.Element {
  const { isConnected } = useWallet();
  const [selectedPair, setSelectedPair] = useState<string>(DEFAULT_TRADING_PAIRS[0].symbol);
  const [timeframe, setTimeframe] = useState<TradingViewTimeframe>('1D');
  const dexApi = useDexApi();
  const { orderBook, trades, userOrders, status } = useWebSocket(selectedPair);

  const marketDetails: TradingPairInfo | undefined = useMemo(
    () => DEFAULT_TRADING_PAIRS.find((pair) => pair.symbol === selectedPair),
    [selectedPair],
  );

  const handlePairChange = useCallback((symbol: string) => {
    setSelectedPair(symbol);
  }, []);

  const handlePlaceOrder = useCallback(
    async (order: OrderParams) => {
      await dexApi.placeOrder(order);
    },
    [dexApi],
  );

  const handleCancelOrder = useCallback(
    async (orderId: string) => {
      await dexApi.cancelOrder(orderId);
    },
    [dexApi],
  );

  const connectionLabel = useMemo(() => {
    switch (status) {
      case 'open':
        return { label: 'Live', className: 'text-green-400', dot: 'bg-green-400' };
      case 'connecting':
        return { label: 'Connecting', className: 'text-accent', dot: 'bg-accent' };
      case 'error':
        return { label: 'Offline', className: 'text-red-400', dot: 'bg-red-400' };
      case 'closed':
        return { label: 'Disconnected', className: 'text-muted', dot: 'bg-muted' };
      default:
        return { label: 'Idle', className: 'text-muted', dot: 'bg-muted' };
    }
  }, [status]);

  return (
    <div className="min-h-screen bg-[color:var(--background)] px-6 py-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Trade</h1>
            <p className="text-sm text-muted">
              Execute limit and market orders with real-time order book visibility.
            </p>
          </div>
          <TradingPairSelector selected={selectedPair} onChange={handlePairChange} />
        </header>

        {marketDetails && (
          <section className="grid grid-cols-2 gap-4 rounded-lg border border-hairline bg-surface p-4 text-sm text-muted md:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide">Last Price</p>
              <p className="text-lg font-semibold text-foreground">
                ${marketDetails.price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide">24h Change</p>
              <p className={`text-lg font-semibold ${marketDetails.changePercent24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {marketDetails.changePercent24h >= 0 ? '+' : ''}
                {marketDetails.changePercent24h.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide">24h High</p>
              <p className="text-lg font-semibold text-foreground">
                ${marketDetails.high24h.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide">24h Volume</p>
              <p className="text-lg font-semibold text-foreground">
                {marketDetails.volume24h.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </section>
        )}

        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-12 lg:col-span-8">
            <div className="glass flex h-full flex-col gap-4 rounded-lg border border-hairline p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{selectedPair} Chart</h2>
                  <p className="text-xs text-muted">Time-weighted data updated in real time.</p>
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
              <div className="h-[420px]">
                <TradingViewChart pair={selectedPair} timeframe={timeframe} className="h-full w-full" />
              </div>
            </div>
          </section>

          <aside className="col-span-12 lg:col-span-4">
            <div className="glass flex h-full flex-col gap-4 rounded-lg border border-hairline p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Order Book</h2>
                <div className={`flex items-center gap-2 text-xs ${connectionLabel.className}`}>
                  <span className={`h-2 w-2 rounded-full ${connectionLabel.dot}`} aria-hidden="true" />
                  <span>{connectionLabel.label}</span>
                </div>
              </div>
              <OrderBook data={orderBook} />
            </div>
          </aside>

          <section className="col-span-12 lg:col-span-4">
            <div className="glass rounded-lg border border-hairline p-4">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Place Order</h2>
              <OrderPanel pair={selectedPair} onPlaceOrder={handlePlaceOrder} disabled={!isConnected} />
            </div>
          </section>

          <section className="col-span-12 lg:col-span-4">
            <div className="glass rounded-lg border border-hairline p-4">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Recent Trades</h2>
              <TradeHistory trades={trades} />
            </div>
          </section>

          <section className="col-span-12 lg:col-span-4">
            <div className="glass rounded-lg border border-hairline p-4">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Your Orders</h2>
              <UserOrders orders={userOrders} onCancelOrder={handleCancelOrder} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
