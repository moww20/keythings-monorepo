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
    console.log('[usePoolsApi] Getting quote:', {
      pool_id: poolId,
      token_in: tokenIn,
      amount_in: amountIn
    });
    
    const response = await fetch('http://localhost:8080/api/pools/quote', {
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
  }, []);

  const executeSwap = useCallback(async (
    poolId: string,
    tokenIn: string,
    amountIn: string,
    minAmountOut?: string
  ): Promise<SwapResponse> => {
    console.log('[usePoolsApi] Executing swap:', {
      pool_id: poolId,
      token_in: tokenIn,
      amount_in: amountIn,
      min_amount_out: minAmountOut || '0'
    });
    
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
    
    console.log('[usePoolsApi] Swap response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[usePoolsApi] Swap failed:', errorText);
      throw new Error(`Failed to execute swap: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('[usePoolsApi] Swap result:', result);
    return result;
  }, []);

  return { fetchPools, getQuote, executeSwap };
}

