'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Info, Link as LinkIcon } from 'lucide-react';
import { SwapPanel } from '@/app/components/SwapPanel';
import { useWallet } from '@/app/contexts/WalletContext';
import { usePoolsApi } from '@/app/hooks/usePoolsApi';
import type {
  PoolInfo,
  SwapExecutionOptions,
  SwapExecutionResult,
  SwapParams,
} from '@/app/types/pools';
import { extractBlockHash, normalizeAccountRef } from '@/app/lib/storage-account-manager';

function shortenSignature(signature: string): string {
  if (signature.length <= 12) {
    return signature;
  }
  return `${signature.slice(0, 6)}…${signature.slice(-6)}`;
}

function formatWithGrouping(value: string): string {
  const [integer, fraction] = value.split('.');
  const formattedInteger = Number(integer).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
  if (!fraction) {
    return formattedInteger;
  }
  return `${formattedInteger}.${fraction}`;
}

export default function SwapPage(): React.JSX.Element {
  const {
    isConnected,
    publicKey,
    tokens,
    userClient,
    storageAccountAddress,
    isTradingEnabling,
    tradingError,
    enableTrading,
  } = useWallet();
  const { fetchPools, getQuote, notifySwapTelemetry } = usePoolsApi();

  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string>('');
  const [isLoadingPools, setIsLoadingPools] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedPool = useMemo(
    () => pools.find((pool) => pool.id === selectedPoolId) ?? null,
    [pools, selectedPoolId],
  );

  const findTokenByIdentifier = useCallback(
    (identifier: string) =>
      tokens.find((token) => token.address === identifier || token.ticker === identifier),
    [tokens],
  );

  const resolveTokenAddress = useCallback(
    (identifier: string): string => {
      const match = findTokenByIdentifier(identifier);
      return match?.address ?? identifier;
    },
    [findTokenByIdentifier],
  );

  const getTokenDecimals = useCallback(
    (identifier: string): number => {
      return findTokenByIdentifier(identifier)?.decimals ?? 9;
    },
    [findTokenByIdentifier],
  );

  const formatBaseUnits = useCallback(
    (amount: string, identifier: string): string => {
      try {
        const raw = BigInt(amount);
        const decimals = getTokenDecimals(identifier);
        if (decimals === 0) {
          return raw.toString();
        }
        const divisor = BigInt(10) ** BigInt(decimals);
        const integer = raw / divisor;
        const remainder = raw % divisor;
        if (remainder === BigInt(0)) {
          return integer.toString();
        }
        const fraction = remainder
          .toString()
          .padStart(decimals, '0')
          .replace(/0+$/, '');
        return `${integer.toString()}.${fraction}`;
      } catch (error) {
        console.warn('[Swap] Failed to format base units', { amount, identifier, error });
        return '0';
      }
    },
    [getTokenDecimals],
  );

  const formatReserve = useCallback(
    (amount: string, identifier: string): string => {
      const formatted = formatBaseUnits(amount, identifier);
      return `${formatWithGrouping(formatted)} ${identifier}`;
    },
    [formatBaseUnits],
  );

  useEffect(() => {
    async function loadPools() {
      try {
        setIsLoadingPools(true);
        const data = await fetchPools();
        setPools(data.pools);
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

  useEffect(() => {
    if (selectedPool) {
      console.log('[Swap] Selected pool details:', selectedPool);
    }
  }, [selectedPool]);

  useEffect(
    () => () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    },
    [],
  );

  const performSwap = useCallback(
    async (params: SwapParams, options?: SwapExecutionOptions): Promise<SwapExecutionResult> => {
      if (!userClient) {
        throw new Error('Wallet client not available. Unlock your wallet to continue.');
      }

      if (!storageAccountAddress) {
        throw new Error('Trading is not enabled. Please create a storage account first.');
      }

      const pool = pools.find((candidate) => candidate.id === params.poolId);
      if (!pool) {
        throw new Error('Selected pool could not be found.');
      }

      const tokenOutSymbol = pool.token_a === params.tokenIn ? pool.token_b : pool.token_a;
      const tokenInAddress = resolveTokenAddress(params.tokenIn);
      const tokenOutAddress = resolveTokenAddress(tokenOutSymbol);

      if (tokenInAddress.startsWith('PLACEHOLDER')) {
        throw new Error('Token address for the input asset is not configured.');
      }

      if (tokenOutAddress.startsWith('PLACEHOLDER')) {
        throw new Error('Token address for the output asset is not configured.');
      }

      const onStatusChange = options?.onStatusChange;
      onStatusChange?.({ status: 'preparing', details: 'Preparing swap transaction.' });

      const builder = userClient.initBuilder();
      if (!builder) {
        throw new Error('Keeta wallet did not provide a transaction builder.');
      }

      const sendFn = (builder as { send?: unknown }).send;
      if (typeof sendFn !== 'function') {
        throw new Error('Wallet builder does not support token transfer operations.');
      }

      let amountIn: bigint;
      let minAmountOut: bigint;
      let expectedAmountOut: bigint | null = null;
      try {
        amountIn = BigInt(params.amountIn);
        minAmountOut = BigInt(params.minAmountOut ?? '0');
        if (params.expectedAmountOut) {
          expectedAmountOut = BigInt(params.expectedAmountOut);
        }
      } catch {
        throw new Error('Swap amounts must be provided in base units.');
      }

      const amountOut = expectedAmountOut && expectedAmountOut >= minAmountOut ? expectedAmountOut : minAmountOut;
      const userStorageRef = normalizeAccountRef(storageAccountAddress);
      const poolStorageRef = normalizeAccountRef(pool.storage_account);
      const tokenInRef = normalizeAccountRef(tokenInAddress);
      const tokenOutRef = normalizeAccountRef(tokenOutAddress);

      onStatusChange?.({ status: 'awaiting-signature', details: 'Authorize the swap in your wallet.' });

      await Promise.resolve(
        sendFn(poolStorageRef, amountIn, {
          token: tokenInRef,
          account: userStorageRef,
        }),
      );

      await Promise.resolve(
        sendFn(userStorageRef, amountOut, {
          token: tokenOutRef,
          account: poolStorageRef,
        }),
      );

      onStatusChange?.({ status: 'submitting', details: 'Publishing transaction to Keeta.' });

      const publishResult = await userClient.publishBuilder(builder);
      const txSignature = extractBlockHash(publishResult) ?? undefined;

      onStatusChange?.({
        status: 'confirming',
        details: 'Transaction submitted. Waiting for confirmation.',
        txSignature,
      });

      const confirmedAt = new Date().toISOString();

      try {
        await notifySwapTelemetry({
          poolId: params.poolId,
          tokenIn: tokenInAddress,
          tokenOut: tokenOutAddress,
          amountIn: params.amountIn,
          amountOut: amountOut.toString(),
          minAmountOut: params.minAmountOut,
          walletAddress: publicKey ?? undefined,
          storageAccount: storageAccountAddress,
          txSignature,
          confirmedAt,
        });
      } catch (telemetryError) {
        console.warn('[Swap] Telemetry dispatch failed:', telemetryError);
      }

      onStatusChange?.({ status: 'confirmed', details: 'Swap confirmed on-chain.', txSignature });

      return {
        amountIn: params.amountIn,
        amountOut: amountOut.toString(),
        tokenIn: params.tokenIn,
        tokenOut: tokenOutSymbol,
        txSignature,
      } satisfies SwapExecutionResult;
    },
    [
      pools,
      notifySwapTelemetry,
      publicKey,
      resolveTokenAddress,
      storageAccountAddress,
      userClient,
    ],
  );

  const handleEnableTrading = useCallback(async () => {
    try {
      await enableTrading();
    } catch (error) {
      console.error('[Swap] Failed to trigger trading enablement:', error);
    }
  }, [enableTrading]);

  const handleSwap = useCallback(
    async (params: SwapParams, options?: SwapExecutionOptions): Promise<SwapExecutionResult> => {
      const result = await performSwap(params, options);
      const formattedAmount = formatWithGrouping(formatBaseUnits(result.amountOut, result.tokenOut));
      const signatureSuffix = result.txSignature ? ` (tx ${shortenSignature(result.txSignature)})` : '';

      setSuccessMessage(`Swap confirmed! Received ${formattedAmount} ${result.tokenOut}${signatureSuffix}`);
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage(null);
      }, 7000);

      try {
        const refreshed = await fetchPools();
        setPools(refreshed.pools);
      } catch (refreshError) {
        console.warn('[Swap] Failed to refresh pools after swap:', refreshError);
      }

      return result;
    },
    [performSwap, formatBaseUnits, fetchPools],
  );

  const formatPoolName = useCallback((pool: PoolInfo): string => {
    return `${pool.token_a}/${pool.token_b}`;
  }, []);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[color:var(--background)] px-6 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="glass rounded-lg border border-hairline p-12">
            <div className="text-center">
              <ArrowLeftRight className="mx-auto mb-4 h-12 w-12 text-muted opacity-50" />
              <h2 className="mb-2 text-xl font-semibold text-foreground">Connect Your Wallet</h2>
              <p className="text-muted">Please connect your wallet to start swapping tokens</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tradingDisabled = !storageAccountAddress;
  const walletNotReady = !userClient;

  return (
    <div className="min-h-screen bg-[color:var(--background)] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold text-foreground">Swap Tokens</h1>
          <p className="text-muted">Trade tokens instantly using liquidity pools</p>
        </div>

        {(tradingDisabled || walletNotReady) && (
          <div className="mb-6 glass rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-5 w-5 text-yellow-400" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-yellow-200">Wallet action required</p>
                  <p className="text-sm text-yellow-100/80">
                    {tradingDisabled && walletNotReady
                      ? 'Unlock your wallet and enable trading to create a storage account before submitting swaps.'
                      : tradingDisabled
                        ? 'Enable trading to create a storage account before submitting swaps.'
                        : 'Unlock your wallet to grant swap permissions.'}
                  </p>
                </div>
              </div>

              {tradingDisabled && (
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  <button
                    type="button"
                    onClick={handleEnableTrading}
                    className="inline-flex items-center justify-center rounded-lg border border-yellow-400/40 bg-yellow-500/20 px-4 py-2 text-sm font-medium text-yellow-50 transition-colors hover:bg-yellow-500/30 focus:outline-none focus:ring-2 focus:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={walletNotReady || isTradingEnabling}
                  >
                    {isTradingEnabling ? 'Enabling…' : 'Enable Trading'}
                  </button>
                  {tradingError && (
                    <p className="text-xs text-yellow-100/70 sm:text-right">{tradingError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 glass rounded-lg border border-green-500/20 bg-green-500/10 p-4">
            <p className="text-sm text-green-300">✓ {successMessage}</p>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-5">
            <div className="glass rounded-lg border border-hairline p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Swap</h2>

              {pools.length > 1 && (
                <div className="mb-6">
                  <label htmlFor="pool-selector" className="mb-2 block text-sm text-muted">
                    Pool
                  </label>
                  <select
                    id="pool-selector"
                    value={selectedPoolId}
                    onChange={(event) => setSelectedPoolId(event.target.value)}
                    className="w-full rounded-lg border border-hairline bg-surface px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
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
                  <svg className="h-8 w-8 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              ) : (
                <SwapPanel
                  pool={selectedPool}
                  tokens={tokens}
                  onSwap={handleSwap}
                  onGetQuote={getQuote}
                  disabled={!userClient || !storageAccountAddress}
                />
              )}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7">
            <div className="glass rounded-lg border border-hairline p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Pool Statistics</h2>

              {selectedPool ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-wide text-muted">Pool Type</p>
                      <p className="text-foreground font-medium">
                        {selectedPool.pool_type === 'constant_product'
                          ? 'Constant Product'
                          : selectedPool.pool_type}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-wide text-muted">Fee Rate</p>
                      <p className="text-foreground font-medium">
                        {(parseFloat(selectedPool.fee_rate) * 100).toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-sm text-muted">Pool Reserves</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="glass rounded-lg border border-hairline p-4">
                        <p className="mb-1 text-xs text-muted">{selectedPool.token_a}</p>
                        <p className="text-xl font-semibold text-foreground">
                          {formatReserve(selectedPool.reserve_a, selectedPool.token_a)}
                        </p>
                      </div>
                      <div className="glass rounded-lg border border-hairline p-4">
                        <p className="mb-1 text-xs text-muted">{selectedPool.token_b}</p>
                        <p className="text-xl font-semibold text-foreground">
                          {formatReserve(selectedPool.reserve_b, selectedPool.token_b)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-wide text-muted">LP Token</p>
                      <p className="font-mono text-sm text-foreground">{selectedPool.lp_token}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-wide text-muted">Total LP Supply</p>
                      <p className="text-foreground font-medium">
                        {formatWithGrouping(formatBaseUnits(selectedPool.total_lp_supply, selectedPool.token_a))}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wide text-muted">Storage Account</p>
                    <p className="font-mono text-sm text-foreground">
                      {selectedPool.storage_account.slice(0, 12)}…{selectedPool.storage_account.slice(-8)}
                    </p>
                  </div>

                  {(selectedPool.pending_settlement || selectedPool.last_swap_signature) && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted">Recent Activity</p>
                      {selectedPool.pending_settlement && (
                        <div className="glass rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-200">
                          Pending reconciliation. Latest swap will be reflected after on-chain balances refresh.
                        </div>
                      )}
                      {selectedPool.last_swap_signature && (
                        <div className="glass rounded-lg border border-hairline p-4">
                          <p className="mb-2 text-xs uppercase tracking-wide text-muted">Last Swap</p>
                          <div className="space-y-1 text-sm text-foreground">
                            <p>
                              {formatWithGrouping(
                                formatBaseUnits(
                                  selectedPool.last_swap_amount_in ?? '0',
                                  selectedPool.last_swap_token_in ?? selectedPool.token_a,
                                ),
                              )}{' '}
                              {selectedPool.last_swap_token_in ?? selectedPool.token_a} →{' '}
                              {formatWithGrouping(
                                formatBaseUnits(
                                  selectedPool.last_swap_amount_out ?? '0',
                                  selectedPool.last_swap_token_out ?? selectedPool.token_b,
                                ),
                              )}{' '}
                              {selectedPool.last_swap_token_out ?? selectedPool.token_b}
                            </p>
                            <p className="text-xs text-muted">
                              Confirmed at {selectedPool.last_swap_confirmed_at ?? 'pending'}
                            </p>
                            <p className="flex items-center gap-2 text-xs text-muted">
                              <LinkIcon className="h-3.5 w-3.5" aria-hidden />
                              <span className="font-mono">
                                {shortenSignature(selectedPool.last_swap_signature)}
                              </span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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

        <div className="mt-6 glass rounded-lg border border-hairline p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/20">
              <ArrowLeftRight className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h3 className="mb-1 font-medium text-foreground">How Swaps Work</h3>
              <p className="text-sm text-muted">
                Swaps are executed through liquidity pools using an automated market maker model. The exchange rate is
                determined by the ratio of tokens in the pool reserves. A{' '}
                {selectedPool ? (parseFloat(selectedPool.fee_rate) * 100).toFixed(2) : '0.30'}% fee is charged on each swap and
                distributed to liquidity providers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
