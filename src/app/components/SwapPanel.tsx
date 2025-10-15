'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownUp } from 'lucide-react';
import type { PoolInfo, QuoteResponse, SwapParams } from '@/app/types/pools';
import type { ProcessedToken } from '@/app/lib/token-utils';

interface SwapPanelProps {
  pool: PoolInfo | null;
  tokens: ProcessedToken[];
  onSwap: (params: SwapParams) => Promise<void>;
  onGetQuote: (poolId: string, tokenIn: string, amountIn: string) => Promise<QuoteResponse>;
  disabled?: boolean;
}

export function SwapPanel({ pool, tokens, onSwap, onGetQuote, disabled = false }: SwapPanelProps) {
  const [tokenInSymbol, setTokenInSymbol] = useState<string>('');
  const [tokenOutSymbol, setTokenOutSymbol] = useState<string>('');
  const [amountIn, setAmountIn] = useState<string>('');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize token selections from pool
  useEffect(() => {
    if (pool) {
      console.log('[SwapPanel] Pool received:', {
        id: pool.id,
        is_paused: pool.is_paused,
        token_a: pool.token_a,
        token_b: pool.token_b
      });
      setTokenInSymbol(pool.token_a);
      setTokenOutSymbol(pool.token_b);
    }
  }, [pool]);

  // Get token details from wallet
  const tokenInDetails = useMemo(() => 
    tokens.find(t => t.ticker === tokenInSymbol),
    [tokens, tokenInSymbol]
  );

  const tokenOutDetails = useMemo(() => 
    tokens.find(t => t.ticker === tokenOutSymbol),
    [tokens, tokenOutSymbol]
  );

  // Debounced quote fetching
  useEffect(() => {
    if (!pool || !amountIn || parseFloat(amountIn) <= 0) {
      setQuote(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsLoadingQuote(true);
        setError(null);
        
        // Convert amount to base units
        const decimals = tokenInDetails?.decimals || 9;
        const amountInBaseUnits = Math.floor(parseFloat(amountIn) * Math.pow(10, decimals)).toString();
        
        const quoteData = await onGetQuote(pool.id, tokenInSymbol, amountInBaseUnits);
        setQuote(quoteData);
      } catch (quoteError) {
        console.error('[SwapPanel] Error fetching quote:', quoteError);
        setError('Failed to get quote. Please try again.');
        setQuote(null);
      } finally {
        setIsLoadingQuote(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [pool, amountIn, tokenInSymbol, onGetQuote, tokenInDetails]);

  // Switch tokens
  const handleSwitchTokens = useCallback(() => {
    setTokenInSymbol(tokenOutSymbol);
    setTokenOutSymbol(tokenInSymbol);
    setAmountIn('');
    setQuote(null);
  }, [tokenInSymbol, tokenOutSymbol]);

  // Handle swap execution
  const handleSwap = useCallback(async () => {
    if (!pool || !amountIn || !quote) {
      return;
    }

    try {
      setIsSwapping(true);
      setError(null);

      // Convert amount to base units
      const decimals = tokenInDetails?.decimals || 9;
      const amountInBaseUnits = Math.floor(parseFloat(amountIn) * Math.pow(10, decimals)).toString();

      await onSwap({
        poolId: pool.id,
        tokenIn: tokenInSymbol,
        amountIn: amountInBaseUnits,
        minAmountOut: quote.minimum_received,
      });

      // Reset form on success
      setAmountIn('');
      setQuote(null);
    } catch (swapError) {
      console.error('[SwapPanel] Error executing swap:', swapError);
      setError(swapError instanceof Error ? swapError.message : 'Failed to execute swap');
    } finally {
      setIsSwapping(false);
    }
  }, [pool, amountIn, quote, tokenInSymbol, tokenInDetails, onSwap]);

  // Format amount from base units to display units
  const formatAmount = (amount: string, decimals: number = 9): string => {
    try {
      const num = parseFloat(amount) / Math.pow(10, decimals);
      return num.toFixed(4);
    } catch {
      return '0.0000';
    }
  };

  // Calculate exchange rate
  const exchangeRate = useMemo(() => {
    if (!quote || !amountIn || parseFloat(amountIn) === 0) return null;
    
    const decimalsOut = tokenOutDetails?.decimals || 9;
    const amountOut = formatAmount(quote.amount_out, decimalsOut);
    const rate = parseFloat(amountOut) / parseFloat(amountIn);
    
    return `1 ${tokenInSymbol} = ${rate.toFixed(6)} ${tokenOutSymbol}`;
  }, [quote, amountIn, tokenInSymbol, tokenOutSymbol, tokenOutDetails]);

  if (!pool) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-muted mb-2">No pools available</p>
          <p className="text-sm text-faint">Create a pool in the Liquidity Pools tab to start swapping</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Token Input (From) */}
      <div className="glass rounded-lg border border-hairline p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-muted">From</label>
          <div className="text-xs text-faint">
            Balance: {tokenInDetails?.formattedAmount || '0.00'}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent text-2xl font-semibold text-foreground outline-none"
            disabled={disabled || pool.is_paused}
          />
          <button
            type="button"
            onClick={handleSwitchTokens}
            className="px-4 py-2 rounded-lg bg-surface border border-hairline text-foreground font-medium hover:bg-surface-strong transition-colors"
            disabled={disabled || pool.is_paused}
          >
            {tokenInSymbol}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setAmountIn(tokenInDetails?.formattedAmount.replace(/,/g, '') || '0')}
          className="mt-2 text-xs text-accent hover:text-foreground transition-colors"
          disabled={disabled || pool.is_paused}
        >
          Max
        </button>
      </div>

      {/* Switch Button */}
      <div className="flex justify-center -my-2">
        <button
          type="button"
          onClick={handleSwitchTokens}
          className="p-2 rounded-full bg-surface border border-hairline text-foreground hover:bg-surface-strong transition-colors"
          disabled={disabled || pool.is_paused}
          title="Switch tokens"
          aria-label="Switch tokens"
        >
          <ArrowDownUp className="h-4 w-4" />
        </button>
      </div>

      {/* Token Output (To) */}
      <div className="glass rounded-lg border border-hairline p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-muted">To (estimated)</label>
          <div className="text-xs text-faint">
            Balance: {tokenOutDetails?.formattedAmount || '0.00'}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 text-2xl font-semibold text-foreground">
            {isLoadingQuote ? (
              <span className="text-muted">Loading...</span>
            ) : quote ? (
              formatAmount(quote.amount_out, tokenOutDetails?.decimals || 9)
            ) : (
              <span className="text-muted">0.00</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSwitchTokens}
            className="px-4 py-2 rounded-lg bg-surface border border-hairline text-foreground font-medium hover:bg-surface-strong transition-colors"
            disabled={disabled || pool.is_paused}
          >
            {tokenOutSymbol}
          </button>
        </div>
      </div>

      {/* Quote Details */}
      {quote && !isLoadingQuote && (
        <div className="glass rounded-lg border border-hairline p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Exchange Rate</span>
            <span className="text-foreground font-medium">{exchangeRate}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Price Impact</span>
            <span className={`font-medium ${parseFloat(quote.price_impact) > 5 ? 'text-red-400' : 'text-foreground'}`}>
              {quote.price_impact}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Minimum Received</span>
            <span className="text-foreground font-medium">
              {formatAmount(quote.minimum_received, tokenOutDetails?.decimals || 9)} {tokenOutSymbol}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Liquidity Provider Fee</span>
            <span className="text-foreground font-medium">
              {formatAmount(quote.fee, tokenInDetails?.decimals || 9)} {tokenInSymbol}
            </span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="glass rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Pool Paused Warning */}
      {pool.is_paused && (() => {
        console.log('[SwapPanel] WARNING: Pool is paused:', pool.id, 'is_paused:', pool.is_paused);
        return (
          <div className="glass rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
            <p className="text-sm text-yellow-400">This pool is currently paused. Swaps are disabled.</p>
          </div>
        );
      })()}

      {/* Swap Button */}
      <button
        type="button"
        onClick={handleSwap}
        disabled={disabled || pool.is_paused || !amountIn || !quote || isSwapping || parseFloat(amountIn) <= 0}
        className="w-full inline-flex items-center justify-center gap-2 bg-accent text-white px-6 py-3 rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSwapping ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Swapping...
          </>
        ) : (
          `Swap ${tokenInSymbol} for ${tokenOutSymbol}`
        )}
      </button>

      {/* High Price Impact Warning */}
      {quote && parseFloat(quote.price_impact) > 5 && (
        <div className="glass rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
          <p className="text-xs text-yellow-400">
            ⚠️ High price impact! Consider reducing the swap amount.
          </p>
        </div>
      )}
    </div>
  );
}

