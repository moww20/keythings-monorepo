'use client';

import React, { useEffect, useRef, useState } from 'react';

interface TradingViewChartProps {
  symbol: string;
  timeframe: '1s' | '15m' | '1H' | '4H' | '1D' | '1W';
  height?: number;
  width?: number;
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

export default function TradingViewChart({ 
  symbol, 
  timeframe, 
  height = 400, 
  width 
}: TradingViewChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TradingViewWidget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Map our timeframes to TradingView format
  const getTradingViewInterval = (tf: string) => {
    switch (tf) {
      case '1s': return '1';
      case '15m': return '15';
      case '1H': return '60';
      case '4H': return '240';
      case '1D': return '1D';
      case '1W': return '1W';
      default: return '1D';
    }
  };

  // Load TradingView script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      console.log('TradingView script loaded');
      setIsLoading(false);
    };
    script.onerror = () => {
      console.error('Failed to load TradingView script');
      setError('Failed to load TradingView chart');
      setIsLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Create/update widget
  useEffect(() => {
    if (isLoading || error || !window.TradingView) return;

    const initializeWidget = () => {
      // Clean up previous widget
      if (widgetRef.current) {
        try {
          widgetRef.current.remove();
        } catch (e) {
          console.warn('Error removing previous widget:', e);
        }
        widgetRef.current = null;
      }

      // Ensure container exists and is mounted
      if (!containerRef.current) {
        console.warn('TradingView container ref is null');
        return;
      }

      if (!containerRef.current.parentNode) {
        console.warn('TradingView container not mounted to DOM');
        return;
      }

      // Check if container has dimensions
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.warn('TradingView container has no dimensions, retrying...');
        setTimeout(initializeWidget, 200);
        return;
      }

      try {
        console.log('Initializing TradingView widget...');
        const widget = new window.TradingView.widget({
        symbol: symbol,
        interval: getTradingViewInterval(timeframe),
        container: containerRef.current,
        datafeed: {
          onReady: (callback: any) => {
            console.log('Datafeed ready');
            callback({
              exchanges: [
                {
                  value: '',
                  name: 'Keeta Network',
                  desc: 'Keeta Network Exchange',
                },
              ],
              symbols_types: [
                {
                  name: 'crypto',
                  value: 'crypto',
                },
              ],
              supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
              supports_marks: false,
              supports_timescale_marks: false,
            });
          },
          searchSymbols: (userInput: string, exchange: string, symbolType: string, onResultReadyCallback: any) => {
            console.log('Search symbols:', userInput, exchange, symbolType);
            onResultReadyCallback([]);
          },
          resolveSymbol: (symbolName: string, onSymbolResolvedCallback: any, onResolveErrorCallback: any) => {
            console.log('Resolve symbol:', symbolName);
            
            // Mock symbol resolution for demo
            const symbolInfo = {
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
            };

            onSymbolResolvedCallback(symbolInfo);
          },
          getBars: (symbolInfo: any, resolution: string, periodParams: any, onHistoryCallback: any, onErrorCallback: any) => {
            console.log('Get bars:', symbolInfo, resolution, periodParams);
            
            // Mock historical data for demo
            const bars: any[] = [];
            const now = Date.now();
            const intervalMs = resolution === '1D' ? 24 * 60 * 60 * 1000 : 
                             resolution === '1H' ? 60 * 60 * 1000 :
                             resolution === '15' ? 15 * 60 * 1000 : 1000;

            for (let i = 100; i >= 0; i--) {
              const time = now - (i * intervalMs);
              const basePrice = 100000 + Math.sin(i * 0.1) * 10000;
              const open = basePrice + (Math.random() - 0.5) * 1000;
              const close = open + (Math.random() - 0.5) * 2000;
              const high = Math.max(open, close) + Math.random() * 500;
              const low = Math.min(open, close) - Math.random() * 500;
              const volume = Math.random() * 1000;

              bars.push({
                time: time,
                open: open,
                high: high,
                low: low,
                close: close,
                volume: volume,
              });
            }

            onHistoryCallback(bars, { noData: false });
          },
          subscribeBars: (symbolInfo: any, resolution: string, onRealtimeCallback: any, subscribeUID: string, onResetCacheNeededCallback: any) => {
            console.log('Subscribe bars:', symbolInfo, resolution, subscribeUID);
            // Mock real-time data
            const interval = setInterval(() => {
              const now = Date.now();
              const basePrice = 100000 + Math.sin(now * 0.0001) * 10000;
              const open = basePrice + (Math.random() - 0.5) * 100;
              const close = open + (Math.random() - 0.5) * 200;
              const high = Math.max(open, close) + Math.random() * 50;
              const low = Math.min(open, close) - Math.random() * 50;
              const volume = Math.random() * 100;

              onRealtimeCallback({
                time: now,
                open: open,
                high: high,
                low: low,
                close: close,
                volume: volume,
              });
            }, 5000);

            // Store interval for cleanup
            (widget as any)._intervals = (widget as any)._intervals || {};
            (widget as any)._intervals[subscribeUID] = interval;
          },
          unsubscribeBars: (subscribeUID: string) => {
            console.log('Unsubscribe bars:', subscribeUID);
            if ((widget as any)._intervals && (widget as any)._intervals[subscribeUID]) {
              clearInterval((widget as any)._intervals[subscribeUID]);
              delete (widget as any)._intervals[subscribeUID];
            }
          },
        },
        width: width || '100%',
        height: height,
        locale: 'en',
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
        enabled_features: [
          'hide_left_toolbar',
          'hide_legend',
          'hide_side_toolbar',
        ],
        autosize: true,
        theme: 'dark',
        style: '1',
        toolbar_bg: '#1e1e1e',
        loading_screen: { backgroundColor: 'transparent', foregroundColor: '#ccc' },
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
        console.log('TradingView widget created successfully');
      } catch (err) {
        console.error('Error creating TradingView widget:', err);
        setError('Failed to create chart');
        // Retry after a delay if widget creation fails
        setTimeout(() => {
          if (containerRef.current && containerRef.current.parentNode) {
            console.log('Retrying widget creation...');
            initializeWidget();
          }
        }, 1000);
      }
    };

    // Add a longer delay to ensure DOM is fully ready
    const timer = setTimeout(() => {
      initializeWidget();
    }, 500); // Increased delay for better reliability

    return () => {
      clearTimeout(timer);
      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [symbol, timeframe, height, width, isLoading, error]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-2"></div>
          <p className="text-muted text-sm">Loading chart...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="mb-2">
            <svg className="h-12 w-12 text-muted mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-muted text-sm">{error}</p>
          <button 
            onClick={() => {
              setError(null);
              setIsLoading(true);
              // Trigger a re-initialization
              setTimeout(() => {
                setIsLoading(false);
              }, 100);
            }}
            className="mt-2 text-accent hover:text-accent/80 text-sm px-3 py-1 border border-accent rounded hover:bg-accent/10"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <div 
        ref={containerRef} 
        className="w-full h-full"
        data-min-height={height}
        data-min-height-px={height}
      />
    </div>
  );
}
