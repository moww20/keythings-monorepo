'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

export type TradingViewTimeframe = '1s' | '15m' | '1H' | '4H' | '1D' | '1W';

export interface TradingViewChartProps {
  pair: string;
  timeframe?: TradingViewTimeframe;
  height?: number;
  className?: string;
}

interface TradingViewWidget {
  on: (event: string, callback: () => void) => void;
  remove: () => void;
}

declare global {
  interface Window {
    TradingView: any;
  }
}

function getTradingViewInterval(timeframe: TradingViewTimeframe): string {
  switch (timeframe) {
    case '1s':
      return '1';
    case '15m':
      return '15';
    case '1H':
      return '60';
    case '4H':
      return '240';
    case '1W':
      return '1W';
    case '1D':
    default:
      return '1D';
  }
}

export function TradingViewChart({
  pair,
  timeframe = '1D',
  height = 400,
  className,
}: TradingViewChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TradingViewWidget | null>(null);
  const retryCountRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const symbol = useMemo(() => pair.replace('/', ''), [pair]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://s3.tradingview.com/tv.js"]',
    );

    if (existingScript && window.TradingView) {
      setIsLoading(false);
      return;
    }

    const script = existingScript ?? document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;

    const handleLoad = () => {
      setIsLoading(false);
    };

    const handleError = () => {
      console.error('Failed to load TradingView script');
      setError('Failed to load TradingView chart');
      setIsLoading(false);
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    if (!existingScript) {
      document.head.appendChild(script);
    }

    return () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
  }, []);

  useEffect(() => {
    if (!isMounted || isLoading || error || typeof window === 'undefined' || !window.TradingView) {
      return;
    }

    const initializeWidget = () => {
      // Limit retries to prevent infinite loop
      if (retryCountRef.current > 10) {
        console.error('TradingView: Max retries reached, giving up');
        setError('Failed to initialize chart after multiple attempts');
        setIsLoading(false);
        return;
      }

      if (widgetRef.current) {
        try {
          widgetRef.current.remove();
        } catch (removalError) {
          console.warn('Failed to remove TradingView widget', removalError);
        }
        widgetRef.current = null;
      }

      const container = containerRef.current;
      if (!container) {
        retryCountRef.current++;
        setTimeout(initializeWidget, 100);
        return;
      }

      // Check if container is properly mounted and visible
      if (!container.parentNode || !container.isConnected) {
        retryCountRef.current++;
        setTimeout(initializeWidget, 100);
        return;
      }

      // Check if container has proper dimensions
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        retryCountRef.current++;
        setTimeout(initializeWidget, 200);
        return;
      }

      // Additional check to ensure the container is in the DOM tree
      if (!document.body.contains(container)) {
        retryCountRef.current++;
        setTimeout(initializeWidget, 100);
        return;
      }

      // Reset retry count on successful initialization
      retryCountRef.current = 0;

      try {
        // Final null check before widget initialization
        if (!container) {
          console.error('[TradingViewChart] Container is null, cannot initialize widget');
          return;
        }

        const widget = new window.TradingView.widget({
          symbol,
          interval: getTradingViewInterval(timeframe),
          container,
          autosize: true,
          locale: 'en',
          theme: 'dark',
          style: '1',
          toolbar_bg: '#1e1e1e',
          disabled_features: [
            'use_localstorage_for_settings',
            'volume_force_overlay',
            'create_volume_indicator_by_default',
            'main_series_scale_menu',
            'header_compare',
            'header_symbol_search',
            'symbol_search_hot_key',
            'compare_symbol',
            'display_market_status',
            'header_widget_dom_node',
          ],
          enabled_features: ['hide_left_toolbar', 'hide_legend', 'hide_side_toolbar'],
          datafeed: {
            onReady: (callback: any) => {
              callback({
                exchanges: [
                  { value: '', name: 'Keeta Network', desc: 'Keeta Network Exchange' },
                ],
                symbols_types: [{ name: 'crypto', value: 'crypto' }],
                supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
                supports_marks: false,
                supports_timescale_marks: false,
              });
            },
            searchSymbols: (_userInput: string, _exchange: string, _symbolType: string, onResultReadyCallback: any) => {
              onResultReadyCallback([]);
            },
            resolveSymbol: (
              symbolName: string,
              onSymbolResolvedCallback: any,
              onResolveErrorCallback: any,
            ) => {
              try {
                onSymbolResolvedCallback({
                  ticker: symbolName,
                  name: symbolName,
                  description: `${symbolName} on Keeta Network`,
                  type: 'crypto',
                  session: '24x7',
                  timezone: 'Etc/UTC',
                  exchange: 'Keeta Network',
                  minmov: 1,
                  pricescale: 100,
                  has_intraday: true,
                  has_no_volume: false,
                  has_weekly_and_monthly: true,
                  supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
                  volume_precision: 2,
                  data_status: 'streaming',
                });
              } catch (resolveError) {
                console.error('Failed to resolve TradingView symbol', resolveError);
                onResolveErrorCallback?.('resolve_error');
              }
            },
            getBars: (
              _symbolInfo: any,
              _resolution: string,
              periodParams: any,
              onHistoryCallback: any,
              onErrorCallback: any,
            ) => {
              try {
                const { from, to } = periodParams ?? {};
                const bars = [] as Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
                const now = Date.now();
                const start = typeof from === 'number' ? from * 1000 : now - 1000 * 60 * 60 * 24;
                const end = typeof to === 'number' ? to * 1000 : now;
                const step = Math.max(Math.floor((end - start) / 50), 60_000);

                for (let t = start; t <= end; t += step) {
                  const base = Math.sin(t / 1000000) * 5 + 50;
                  const open = base + Math.random();
                  const close = open + (Math.random() - 0.5) * 2;
                  const high = Math.max(open, close) + Math.random() * 2;
                  const low = Math.min(open, close) - Math.random() * 2;
                  const volume = Math.abs(Math.random() * 1000);
                  bars.push({ time: Math.floor(t / 1000), open, high, low, close, volume });
                }

                onHistoryCallback(bars, { noData: false });
              } catch (barsError) {
                console.error('Failed to generate mock bars', barsError);
                onErrorCallback?.(barsError);
              }
            },
            subscribeBars: (
              _symbolInfo: any,
              _resolution: string,
              onRealtimeCallback: any,
              subscribeUID: string,
              _onResetCacheNeededCallback: any,
            ) => {
              const interval = window.setInterval(() => {
                const time = Math.floor(Date.now() / 1000);
                const base = Math.sin(Date.now() / 1000000) * 5 + 50;
                const open = base + Math.random();
                const close = open + (Math.random() - 0.5) * 2;
                const high = Math.max(open, close) + Math.random() * 2;
                const low = Math.min(open, close) - Math.random() * 2;
                const volume = Math.abs(Math.random() * 1000);
                onRealtimeCallback({ time, open, high, low, close, volume });
              }, 5000);

              (widget as any)._intervals = (widget as any)._intervals || {};
              (widget as any)._intervals[subscribeUID] = interval;
            },
            unsubscribeBars: (_subscribeUID: string) => {
              const intervals = (widget as any)._intervals;
              if (!intervals) return;
              const interval = intervals[_subscribeUID];
              if (interval) {
                clearInterval(interval);
                delete intervals[_subscribeUID];
              }
            },
          },
          overrides: {
            'paneProperties.background': '#0b0b0f',
            'paneProperties.vertGridProperties.color': '#1a1a1a',
            'paneProperties.horzGridProperties.color': '#1a1a1a',
            'symbolWatermarkProperties.transparency': 90,
            'scalesProperties.textColor': '#9aa0a6',
            'mainSeriesProperties.candleStyle.upColor': '#26a69a',
            'mainSeriesProperties.candleStyle.downColor': '#ef5350',
            'mainSeriesProperties.candleStyle.borderUpColor': '#26a69a',
            'mainSeriesProperties.candleStyle.borderDownColor': '#ef5350',
            'mainSeriesProperties.candleStyle.wickUpColor': '#26a69a',
            'mainSeriesProperties.candleStyle.wickDownColor': '#ef5350',
          },
        });

        widgetRef.current = widget;
      } catch (widgetError) {
        console.error('TradingView widget initialization failed:', widgetError);
        setError('Failed to render TradingView chart');
      }
    };

    // Add a delay to ensure the DOM is fully ready and mounted
    const timeoutId = setTimeout(() => {
      initializeWidget();
    }, 300);

    const resizeObserver = new ResizeObserver(() => {
      if (!isLoading && !error) {
        initializeWidget();
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [error, isLoading, symbol, timeframe, isMounted]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted">Loading chart...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className={`${className} min-h-[400px]`}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

export default TradingViewChart;
