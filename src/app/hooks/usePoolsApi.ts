import { useCallback, useMemo } from 'react';
import type { PoolInfo, QuoteResponse, SwapTelemetryPayload } from '@/app/types/pools';

export function usePoolsApi() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_DEX_API_URL || 'http://localhost:8080', []);

  const fetchPools = useCallback(async (): Promise<{ pools: PoolInfo[] }> => {
    try {
      const response = await fetch(`${apiBase}/api/pools/list`);
      if (!response.ok) {
        throw new Error(`Failed to fetch pools: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error(
          `Unable to connect to backend server at ${apiBase}. ` +
          `Please ensure the keythings-dapp-engine is running. ` +
          `Start it with: cd keythings-dapp-engine && cargo run`
        );
      }
      throw error;
    }
  }, [apiBase]);

  const getQuote = useCallback(async (
    poolId: string,
    tokenIn: string,
    amountIn: string
  ): Promise<QuoteResponse> => {
    console.log('[usePoolsApi] Getting quote:', {
      pool_id: poolId,
      token_in: tokenIn,
      amount_in: amountIn
    });
    
    try {
      const response = await fetch(`${apiBase}/api/pools/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pool_id: poolId, token_in: tokenIn, amount_in: amountIn })
      });
      
      console.log('[usePoolsApi] Quote response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[usePoolsApi] Quote failed:', errorText);
        throw new Error(`Failed to get quote: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('[usePoolsApi] Quote result:', result);
      return result;
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error(
          `Unable to connect to backend server at ${apiBase}. ` +
          `Please ensure the keythings-dapp-engine is running.`
        );
      }
      throw error;
    }
  }, [apiBase]);

  const notifySwapTelemetry = useCallback(async (
    payload: SwapTelemetryPayload
  ): Promise<void> => {
    console.log('[usePoolsApi] Sending swap telemetry:', payload);

    try {
      const response = await fetch(`${apiBase}/api/pools/swap/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pool_id: payload.poolId,
          token_in: payload.tokenIn,
          token_out: payload.tokenOut,
          amount_in: payload.amountIn,
          amount_out: payload.amountOut,
          min_amount_out: payload.minAmountOut,
          wallet_address: payload.walletAddress,
          storage_account: payload.storageAccount,
          tx_signature: payload.txSignature,
          confirmed_at: payload.confirmedAt,
        }),
      });

      console.log('[usePoolsApi] Swap telemetry status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[usePoolsApi] Telemetry failed:', errorText);
        throw new Error(`Failed to send swap telemetry: ${errorText}`);
      }
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error(
          `Unable to connect to backend server at ${apiBase}. ` +
          `Please ensure the keythings-dapp-engine is running.`
        );
      }
      throw error;
    }
  }, [apiBase]);

  return { fetchPools, getQuote, notifySwapTelemetry };
}

