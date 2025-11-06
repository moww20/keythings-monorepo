'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

export type TradingViewTimeframe = '1s' | '15m' | '1H' | '4H' | '1D' | '1W';

type ChartTimeframe = '1D' | '7D' | '30D' | '90D';

interface ChartCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartResponse {
  pair: string;
  timeframe: ChartTimeframe;
  granularitySeconds: number;
  updatedAt: string;
  source: string;
  candles: ChartCandle[];
}

interface TradingViewBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CachedChart {
  timeframe: ChartTimeframe;
  fetchedAt: number;
  bars: TradingViewBar[];
  granularityMs: number;
  ttlMs: number;
}

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

const timeframeMap: Record<TradingViewTimeframe, ChartTimeframe> = {
  '1s': '1D',
  '15m': '1D',
  '1H': '7D',
  '4H': '30D',
  '1D': '30D',
  '1W': '90D',
};

const DEFAULT_REFRESH_MS = 60_000;

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

async function fetchChartData(timeframe: ChartTimeframe): Promise<ChartResponse> {
  const params = new URLSearchParams({ timeframe });
  const response = await fetch(`/api/market-data/kta-usdt?${params.toString()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Chart data request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ChartResponse;
  return payload;
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
  const chartCacheRef = useRef<CachedChart | null>(null);
  const inflightRef = useRef<Promise<CachedChart> | null>(null);
  const lastEmittedRef = useRef<TradingViewBar | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const symbol = useMemo(() => pair.replace('/', ''), [pair]);
  const containerId = useMemo(
    () => `tv-chart-${symbol.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`,
    [symbol],
  );
  const queryTimeframe = useMemo(() => timeframeMap[timeframe] ?? '1D', [timeframe]);

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

        const toTradingViewBars = (candles: ChartCandle[]): TradingViewBar[] =>
          candles.map((candle) => ({
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
          }));

        const loadBars = async (): Promise<CachedChart> => {
          const now = Date.now();
          const cached = chartCacheRef.current;
          if (cached && cached.timeframe === queryTimeframe && now - cached.fetchedAt < cached.ttlMs) {
            return cached;
          }

          if (inflightRef.current) {
            try {
              const inflight = await inflightRef.current;
              if (inflight.timeframe === queryTimeframe) {
                return inflight;
              }
            } catch (inflightError) {

            }
          }

          const request = fetchChartData(queryTimeframe)
            .then((chart) => {
              const bars = toTradingViewBars(chart.candles);
              const granularityMs = Math.max(chart.granularitySeconds * 1000, DEFAULT_REFRESH_MS);
              const ttlMs = Math.max(granularityMs, 45_000);
              const cachedChart: CachedChart = {
                timeframe: queryTimeframe,
                fetchedAt: Date.now(),
                bars,
                granularityMs,
                ttlMs,
              };
              chartCacheRef.current = cachedChart;
              setError(null);
              return cachedChart;
            })
            .finally(() => {
              inflightRef.current = null;
            });

          inflightRef.current = request;
          return request;
        };

        const widget = new window.TradingView.widget({
          symbol,
          interval: getTradingViewInterval(timeframe),
          container_id: containerId,
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
              _periodParams: any,
              onHistoryCallback: any,
              onErrorCallback: any,
            ) => {
              loadBars()
                .then((cachedChart) => {
                  const { bars } = cachedChart;
                  if (bars.length === 0) {
                    onHistoryCallback([], { noData: true });
                    return;
                  }
                  lastEmittedRef.current = bars[bars.length - 1];
                  onHistoryCallback(bars, { noData: false });
                })
                .catch((barsError) => {
                  console.error('Failed to load chart data', barsError);
                  setError('Failed to load chart data');
                  onErrorCallback?.(barsError);
                });
            },
            subscribeBars: (
              _symbolInfo: any,
              _resolution: string,
              onRealtimeCallback: any,
              subscribeUID: string,
              _onResetCacheNeededCallback: any,
            ) => {
              const scheduleMs = () => chartCacheRef.current?.granularityMs ?? DEFAULT_REFRESH_MS;

              const tick = async () => {
                try {
                  const cachedChart = await loadBars();
                  const { bars } = cachedChart;
                  if (bars.length > 0) {
                    const lastBar = bars[bars.length - 1];
                    const previous = lastEmittedRef.current;
                    const changed =
                      !previous ||
                      previous.time !== lastBar.time ||
                      previous.open !== lastBar.open ||
                      previous.high !== lastBar.high ||
                      previous.low !== lastBar.low ||
                      previous.close !== lastBar.close ||
                      previous.volume !== lastBar.volume;

                    if (changed) {
                      lastEmittedRef.current = lastBar;
                      onRealtimeCallback(lastBar);
                    }
                  }
                } catch (tickError) {
                  console.error('Failed to refresh chart data', tickError);
                }
              };

              const interval = window.setInterval(() => {
                void tick();
              }, scheduleMs());

              void tick();

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
  }, [containerId, error, isLoading, symbol, timeframe, queryTimeframe, isMounted]);

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
      <div id={containerId} ref={containerRef} className="h-full w-full" />
    </div>
  );
}

export default TradingViewChart;
