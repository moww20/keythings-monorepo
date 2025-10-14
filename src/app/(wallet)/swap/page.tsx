'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { SwapPanel } from '@/app/components/SwapPanel';
import { useWallet } from '@/app/contexts/WalletContext';
import { usePoolsApi } from '@/app/hooks/usePoolsApi';
import type { PoolInfo, SwapParams } from '@/app/types/pools';

export default function SwapPage(): React.JSX.Element {
  const { isConnected, publicKey, tokens } = useWallet();
  const { fetchPools, getQuote, executeSwap } = usePoolsApi();

  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string>('');
  const [isLoadingPools, setIsLoadingPools] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch pools on mount
  useEffect(() => {
    async function loadPools() {
      try {
        setIsLoadingPools(true);
        const data = await fetchPools();
        // Show all pools (including paused ones) - SwapPanel will handle paused state
        setPools(data.pools);
        
        // Auto-select first pool
        if (data.pools.length > 0 && !selectedPoolId) {
          setSelectedPoolId(data.pools[0].id);
        }
      } catch (error) {
        console.error('[Swap] Error loading pools:', error);
      } finally {
        setIsLoadingPools(false);
      }
    }

    if (isConnected) {
      loadPools();
    }
  }, [isConnected, fetchPools, selectedPoolId]);

  const selectedPool = pools.find(p => p.id === selectedPoolId) || null;

  // Handle swap execution
  const handleSwap = useCallback(async (params: SwapParams) => {
    try {
      const result = await executeSwap(
        params.poolId,
        params.tokenIn,
        params.amountIn,
        params.minAmountOut
      );

      console.log('[Swap] Swap executed successfully:', result);
      setSuccessMessage(`Swap successful! Received ${result.amount_out} tokens.`);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error('[Swap] Error executing swap:', error);
      throw error; // Re-throw to let SwapPanel handle the error display
    }
  }, [executeSwap]);

  // Format pool display name
  const formatPoolName = (pool: PoolInfo): string => {
    return `${pool.token_a}/${pool.token_b}`;
  };

  // Format reserve amount
  const formatReserve = (amount: string, symbol: string, decimals: number = 9): string => {
    try {
      const num = parseFloat(amount) / Math.pow(10, decimals);
      return `${num.toFixed(2)} ${symbol}`;
    } catch {
      return `0.00 ${symbol}`;
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[color:var(--background)] px-6 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="glass rounded-lg border border-hairline p-12">
            <div className="text-center">
              <ArrowLeftRight className="h-12 w-12 text-muted opacity-50 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Connect Your Wallet</h2>
              <p className="text-muted">Please connect your wallet to start swapping tokens</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Swap Tokens</h1>
          <p className="text-muted">Trade tokens instantly using liquidity pools</p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 glass rounded-lg border border-green-500/20 bg-green-500/10 p-4">
            <p className="text-sm text-green-400">✓ {successMessage}</p>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Swap Panel */}
          <div className="col-span-12 lg:col-span-5">
            <div className="glass rounded-lg border border-hairline p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Swap</h2>

              {/* Pool Selector */}
              {pools.length > 1 && (
                <div className="mb-6">
                  <label htmlFor="pool-selector" className="block text-sm text-muted mb-2">Pool</label>
                  <select
                    id="pool-selector"
                    value={selectedPoolId}
                    onChange={(e) => setSelectedPoolId(e.target.value)}
                    className="w-full bg-surface border border-hairline rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    disabled={isLoadingPools}
                    aria-label="Select trading pool"
                  >
                    {pools.map((pool) => (
                      <option key={pool.id} value={pool.id}>
                        {formatPoolName(pool)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isLoadingPools ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : (
                <SwapPanel
                  pool={selectedPool}
                  tokens={tokens}
                  onSwap={handleSwap}
                  onGetQuote={getQuote}
                  disabled={!isConnected}
                />
              )}
            </div>
          </div>

          {/* Pool Statistics */}
          <div className="col-span-12 lg:col-span-7">
            <div className="glass rounded-lg border border-hairline p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Pool Statistics</h2>

              {selectedPool ? (
                <div className="space-y-6">
                  {/* Pool Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted uppercase tracking-wide mb-1">Pool Type</p>
                      <p className="text-foreground font-medium">
                        {selectedPool.pool_type === 'constant_product' ? 'Constant Product' : selectedPool.pool_type}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted uppercase tracking-wide mb-1">Fee Rate</p>
                      <p className="text-foreground font-medium">
                        {(parseFloat(selectedPool.fee_rate) * 100).toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  {/* Reserves */}
                  <div>
                    <p className="text-sm text-muted mb-3">Pool Reserves</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="glass rounded-lg border border-hairline p-4">
                        <p className="text-xs text-muted mb-1">{selectedPool.token_a}</p>
                        <p className="text-xl font-semibold text-foreground">
                          {formatReserve(
                            selectedPool.reserve_a,
                            selectedPool.token_a,
                            tokens.find(t => t.ticker === selectedPool.token_a)?.decimals || 9
                          )}
                        </p>
                      </div>
                      <div className="glass rounded-lg border border-hairline p-4">
                        <p className="text-xs text-muted mb-1">{selectedPool.token_b}</p>
                        <p className="text-xl font-semibold text-foreground">
                          {formatReserve(
                            selectedPool.reserve_b,
                            selectedPool.token_b,
                            tokens.find(t => t.ticker === selectedPool.token_b)?.decimals || 9
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* LP Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted uppercase tracking-wide mb-1">LP Token</p>
                      <p className="text-foreground font-medium font-mono text-sm">
                        {selectedPool.lp_token}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted uppercase tracking-wide mb-1">Total LP Supply</p>
                      <p className="text-foreground font-medium">
                        {formatReserve(selectedPool.total_lp_supply, '', 9)}
                      </p>
                    </div>
                  </div>

                  {/* Storage Account */}
                  <div>
                    <p className="text-xs text-muted uppercase tracking-wide mb-1">Storage Account</p>
                    <p className="text-foreground font-mono text-sm">
                      {selectedPool.storage_account.slice(0, 12)}...{selectedPool.storage_account.slice(-8)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <p className="text-muted">No pool selected</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-6 glass rounded-lg border border-hairline p-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <ArrowLeftRight className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h3 className="text-foreground font-medium mb-1">How Swaps Work</h3>
              <p className="text-sm text-muted">
                Swaps are executed through liquidity pools using an automated market maker (AMM) model. 
                The exchange rate is determined by the ratio of tokens in the pool reserves. 
                A {selectedPool ? (parseFloat(selectedPool.fee_rate) * 100).toFixed(2) : '0.30'}% fee is charged on each swap and distributed to liquidity providers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

