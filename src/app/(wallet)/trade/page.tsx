'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';

import { TokenSwapSelector } from '@/app/components/TradingPairSelector';
import { TradingViewChart, type TradingViewTimeframe } from '@/app/components/TradingViewChart';
import { useWallet } from '@/app/contexts/WalletContext';
import { RFQProvider } from '@/app/contexts/RFQContext';
import { loadTokenCatalogFromEnv } from '@/app/config/token-catalog';
import type { TokenChoice, WalletTokenBalance } from '@/app/types/token';
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

const DEFAULT_PAIR_SYMBOL = process.env.NEXT_PUBLIC_RFQ_DEFAULT_PAIR?.trim() ?? '';
const NORMALIZED_DEFAULT_PAIR = DEFAULT_PAIR_SYMBOL.toUpperCase();

interface MarketPairInfo {
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

function normalizeSymbol(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value.trim().toUpperCase();
}

function normalizeAddress(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value.trim().toLowerCase();
}

export default function TradePage(): React.JSX.Element {
  const { isConnected, tokens: walletTokens } = useWallet();
  const [catalogConfig, setCatalogConfig] = useState(() => loadTokenCatalogFromEnv());
  const [tokenA, setTokenA] = useState<TokenChoice | null>(null);
  const [tokenB, setTokenB] = useState<TokenChoice | null>(null);
  const [timeframe, setTimeframe] = useState<TradingViewTimeframe>('1D');
  const [mode, setMode] = useState<TradePageMode>('rfq_taker');
  const [ktaPriceData, setKtaPriceData] = useState<{
    usd: number;
    usd_24h_change: number;
    usd_24h_vol: number;
  } | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [marketPairs, setMarketPairs] = useState<MarketPairInfo[]>([]);
  const [isLoadingPairs, setIsLoadingPairs] = useState(false);
  const [pairsError, setPairsError] = useState<string | null>(null);
  const [initialTokensSet, setInitialTokensSet] = useState(false);

  const catalogTokens = catalogConfig.tokens;
  const catalogErrors = catalogConfig.errors;

  const walletBalances = useMemo<WalletTokenBalance[]>(() => {
    return walletTokens.map((token) => ({
      address: token.address,
      balance: token.balance,
      formattedAmount: token.formattedAmount,
    }));
  }, [walletTokens]);

  const walletBalanceByAddress = useMemo(() => {
    const map = new Map<string, WalletTokenBalance>();
    walletBalances.forEach((entry) => {
      map.set(normalizeAddress(entry.address), entry);
    });
    return map;
  }, [walletBalances]);

  const catalogChoices = useMemo<TokenChoice[]>(() => {
    return catalogTokens.map((entry) => {
      const normalizedAddress = normalizeAddress(entry.address);
      const walletBalance = walletBalanceByAddress.get(normalizedAddress);
      return {
        ...entry,
        symbol: normalizeSymbol(entry.symbol),
        isListed: true,
        balance: walletBalance?.balance,
        formattedAmount: walletBalance?.formattedAmount,
      } satisfies TokenChoice;
    });
  }, [catalogTokens, walletBalanceByAddress]);

  const catalogChoiceBySymbol = useMemo(() => {
    const map = new Map<string, TokenChoice>();
    catalogChoices.forEach((choice) => {
      map.set(choice.symbol, choice);
    });
    return map;
  }, [catalogChoices]);

  const handleRefreshCatalog = useCallback(() => {
    setCatalogConfig(loadTokenCatalogFromEnv());
  }, []);

  const reconcileChoice = useCallback(
    (choice: TokenChoice | null): TokenChoice | null => {
      if (!choice) {
        return null;
      }

      if (choice.isListed) {
        const replacement = catalogChoiceBySymbol.get(normalizeSymbol(choice.symbol));
        if (replacement) {
          return { ...replacement };
        }
      } else if (choice.address) {
        const normalizedAddress = normalizeAddress(choice.address);
        const walletBalance = walletBalanceByAddress.get(normalizedAddress);
        return {
          ...choice,
          balance: walletBalance?.balance ?? choice.balance,
          formattedAmount: walletBalance?.formattedAmount ?? choice.formattedAmount,
        } satisfies TokenChoice;
      }

      return { ...choice } satisfies TokenChoice;
    },
    [catalogChoiceBySymbol, walletBalanceByAddress],
  );

  const applyLatestChoiceData = useCallback(
    (previous: TokenChoice | null): TokenChoice | null => {
      const updated = reconcileChoice(previous);
      if (!previous || !updated) {
        return updated;
      }

      const unchanged =
        normalizeSymbol(previous.symbol) === normalizeSymbol(updated.symbol) &&
        normalizeAddress(previous.address) === normalizeAddress(updated.address) &&
        previous.balance === updated.balance &&
        previous.formattedAmount === updated.formattedAmount &&
        previous.isListed === updated.isListed;

      return unchanged ? previous : updated;
    },
    [reconcileChoice],
  );

  useEffect(() => {
    setTokenA((prev) => applyLatestChoiceData(prev));
    setTokenB((prev) => applyLatestChoiceData(prev));
  }, [applyLatestChoiceData]);

  const getChoiceForSymbol = useCallback(
    (symbol: string): TokenChoice | null => {
      const normalizedSymbol = normalizeSymbol(symbol);
      if (!normalizedSymbol) {
        return null;
      }

      const catalogChoice = catalogChoiceBySymbol.get(normalizedSymbol);
      if (catalogChoice) {
        return { ...catalogChoice } satisfies TokenChoice;
      }

      const walletToken = walletTokens.find(
        (token) => normalizeSymbol(token.ticker) === normalizedSymbol,
      );

      if (walletToken) {
        return {
          symbol: normalizedSymbol,
          address: walletToken.address,
          name: walletToken.name,
          decimals: walletToken.decimals,
          icon: walletToken.icon,
          isListed: false,
          balance: walletToken.balance,
          formattedAmount: walletToken.formattedAmount,
        } satisfies TokenChoice;
      }

      return null;
    },
    [catalogChoiceBySymbol, walletTokens],
  );

  const setTokensForPairSymbol = useCallback(
    (pairSymbol: string) => {
      const [baseSymbol = '', quoteSymbol = ''] = pairSymbol.split('/');
      const nextTokenA = getChoiceForSymbol(baseSymbol);
      const nextTokenB = getChoiceForSymbol(quoteSymbol);

      if (nextTokenA) {
        setTokenA(reconcileChoice(nextTokenA));
      }
      if (nextTokenB) {
        setTokenB(reconcileChoice(nextTokenB));
      }

      if (nextTokenA && nextTokenB) {
        setInitialTokensSet(true);
      }
    },
    [getChoiceForSymbol, reconcileChoice],
  );

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

  const selectedPairSymbol = useMemo<string | null>(() => {
    if (!tokenA || !tokenB) {
      return null;
    }
    return `${tokenA.symbol}/${tokenB.symbol}`;
  }, [tokenA, tokenB]);

  const marketDetails = useMemo<MarketPairInfo | undefined>(() => {
    if (!selectedPairSymbol) {
      return undefined;
    }

    const currentPair = marketPairs.find(
      (pair) => pair.symbol.toUpperCase() === selectedPairSymbol.toUpperCase(),
    );

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
      } satisfies MarketPairInfo;
    }

    return currentPair;
  }, [selectedPairSymbol, marketPairs, ktaPriceData]);

  const handleTokenSelection = useCallback(
    ({ tokenA: nextTokenA, tokenB: nextTokenB }: { tokenA: TokenChoice | null; tokenB: TokenChoice | null }) => {
      setTokenA(nextTokenA ? reconcileChoice(nextTokenA) : null);
      setTokenB(nextTokenB ? reconcileChoice(nextTokenB) : null);
      if (nextTokenA && nextTokenB) {
        setInitialTokensSet(true);
      }
    },
    [reconcileChoice],
  );

  const handleModeChange = useCallback((nextMode: TradePageMode) => {
    setMode(nextMode);
  }, []);

  const handlePairRecommendation = useCallback(
    (pairSymbol: string) => {
      setTokensForPairSymbol(pairSymbol);
    },
    [setTokensForPairSymbol],
  );

  useEffect(() => {
    let cancelled = false;
    const loadPairs = async () => {
      try {
        setIsLoadingPairs(true);
        setPairsError(null);
        const pairs = await fetchRfqAvailablePairs();
        if (cancelled) {
          return;
        }

        const nextPairs: MarketPairInfo[] = pairs.map((pairSymbol) => {
          const [base = '', quote = ''] = pairSymbol.split('/');
          const normalizedBase = normalizeSymbol(base);
          const normalizedQuote = normalizeSymbol(quote);
          return {
            base: normalizedBase,
            quote: normalizedQuote,
            symbol: `${normalizedBase}/${normalizedQuote}`,
            price: 0,
            change24h: 0,
            changePercent24h: 0,
            high24h: 0,
            low24h: 0,
            volume24h: 0,
            volume24hQuote: 0,
          } satisfies MarketPairInfo;
        });

        setMarketPairs(nextPairs);

        if (!initialTokensSet) {
          const preferred = nextPairs.find(
            (pair) => pair.symbol.toUpperCase() === NORMALIZED_DEFAULT_PAIR,
          );
          const fallback = preferred ?? nextPairs[0];
          if (fallback) {
            setTokensForPairSymbol(fallback.symbol);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setPairsError(error instanceof Error ? error.message : 'Failed to load RFQ markets.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPairs(false);
        }
      }
    };

    void loadPairs();
    return () => {
      cancelled = true;
    };
  }, [initialTokensSet, setTokensForPairSymbol]);

  useEffect(() => {
    if (initialTokensSet) {
      return;
    }

    const attemptDefaultFromCatalog = () => {
      if (NORMALIZED_DEFAULT_PAIR) {
        const [baseSymbol = '', quoteSymbol = ''] = NORMALIZED_DEFAULT_PAIR.split('/');
        const defaultTokenA = getChoiceForSymbol(baseSymbol);
        const defaultTokenB = getChoiceForSymbol(quoteSymbol);
        if (defaultTokenA && defaultTokenB) {
          setTokenA(reconcileChoice(defaultTokenA));
          setTokenB(reconcileChoice(defaultTokenB));
          setInitialTokensSet(true);
          return true;
        }
      }
      return false;
    };

    const appliedDefault = attemptDefaultFromCatalog();
    if (appliedDefault) {
      return;
    }

    if (catalogChoices.length >= 2) {
      setTokenA(reconcileChoice(catalogChoices[0]));
      setTokenB(reconcileChoice(catalogChoices[1]));
      setInitialTokensSet(true);
      return;
    }

    if (walletTokens.length >= 2) {
      const [firstToken, ...rest] = walletTokens;
      const secondToken = rest.find(
        (candidate) => normalizeSymbol(candidate.ticker) !== normalizeSymbol(firstToken.ticker),
      );
      const fallbackA = getChoiceForSymbol(firstToken.ticker ?? '');
      const fallbackB = secondToken ? getChoiceForSymbol(secondToken.ticker ?? '') : null;
      if (fallbackA && fallbackB) {
        setTokenA(reconcileChoice(fallbackA));
        setTokenB(reconcileChoice(fallbackB));
        setInitialTokensSet(true);
      }
    }
  }, [
    catalogChoices,
    getChoiceForSymbol,
    initialTokensSet,
    reconcileChoice,
    walletTokens,
  ]);

  return (
    <div className="min-h-screen bg-[color:var(--background)] px-6 py-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <section className="relative z-30 rounded-lg border border-hairline bg-surface/70 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex w-full flex-col gap-2">
              <TokenSwapSelector
                tokenA={tokenA}
                tokenB={tokenB}
                catalog={catalogTokens}
                walletBalances={walletBalances}
                onChange={handleTokenSelection}
                onRefreshCatalog={handleRefreshCatalog}
              />
              {pairsError ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {pairsError}
                </div>
              ) : null}
            </div>

            {marketDetails ? (
              <div className="grid w-full max-w-sm grid-cols-2 gap-4 text-sm text-muted sm:grid-cols-3">
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
                  <p
                    className={`text-sm font-semibold ${
                      marketDetails.changePercent24h >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
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
            ) : null}
          </div>
        </section>

        <RFQProvider
          tokenA={tokenA ? { symbol: tokenA.symbol, address: tokenA.address, decimals: tokenA.decimals, isListed: tokenA.isListed } : null}
          tokenB={tokenB ? { symbol: tokenB.symbol, address: tokenB.address, decimals: tokenB.decimals, isListed: tokenB.isListed } : null}
        >
          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-12 lg:col-span-8">
              <div className="grid grid-cols-1 gap-4">
                <div className="glass rounded-lg border border-hairline p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        {selectedPairSymbol ? `${selectedPairSymbol} RFQ Chart` : 'RFQ Chart'}
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
                          disabled={!selectedPairSymbol}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[360px] flex items-center justify-center">
                    {selectedPairSymbol ? (
                      <TradingViewChart pair={selectedPairSymbol} timeframe={timeframe} className="h-full w-full" />
                    ) : (
                      <span className="text-sm text-muted">Select a market to load the RFQ chart.</span>
                    )}
                  </div>
                </div>
                <RFQDepthChart />
                <div className="glass rounded-lg border border-hairline p-4">
                  {selectedPairSymbol ? (
                    <RFQOrderBook onPairChange={handlePairRecommendation} />
                  ) : (
                    <div className="text-sm text-muted text-center">
                      Select a market to view the RFQ order book.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <aside className="col-span-12 lg:col-span-4 flex flex-col gap-4">
              <RFQUnifiedPanel mode={mode} onModeChange={handleModeChange} onPairChange={handlePairRecommendation} />
            </aside>
          </div>
        </RFQProvider>
      </div>
    </div>
  );
}
