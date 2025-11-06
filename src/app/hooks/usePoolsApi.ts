import { useCallback, useMemo } from 'react';
import type { PoolInfo, QuoteResponse } from '@/app/types/pools';

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
          `Please ensure the backend service is running.`
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

    try {
      const response = await fetch(`${apiBase}/api/pools/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pool_id: poolId, token_in: tokenIn, amount_in: amountIn })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[usePoolsApi] Quote failed:', errorText);
        throw new Error(`Failed to get quote: ${errorText}`);
      }
      
      const result = await response.json();

      return result;
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error(
          `Unable to connect to backend server at ${apiBase}. ` +
          `Please ensure the backend service is running.`
        );
      }
      throw error;
    }
  }, [apiBase]);

  return { fetchPools, getQuote };
}

