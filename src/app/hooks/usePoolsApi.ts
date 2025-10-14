import { useCallback } from 'react';
import type { PoolInfo, QuoteResponse, SwapResponse } from '@/app/types/pools';

export function usePoolsApi() {
  const fetchPools = useCallback(async (): Promise<{ pools: PoolInfo[] }> => {
    const response = await fetch('http://localhost:8080/api/pools/list');
    if (!response.ok) throw new Error('Failed to fetch pools');
    return await response.json();
  }, []);

  const getQuote = useCallback(async (
    poolId: string,
    tokenIn: string,
    amountIn: string
  ): Promise<QuoteResponse> => {
    const response = await fetch('http://localhost:8080/api/pools/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pool_id: poolId, token_in: tokenIn, amount_in: amountIn })
    });
    if (!response.ok) throw new Error('Failed to get quote');
    return await response.json();
  }, []);

  const executeSwap = useCallback(async (
    poolId: string,
    tokenIn: string,
    amountIn: string,
    minAmountOut?: string
  ): Promise<SwapResponse> => {
    const response = await fetch('http://localhost:8080/api/pools/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pool_id: poolId,
        token_in: tokenIn,
        amount_in: amountIn,
        min_amount_out: minAmountOut || '0'
      })
    });
    if (!response.ok) throw new Error('Failed to execute swap');
    return await response.json();
  }, []);

  return { fetchPools, getQuote, executeSwap };
}

