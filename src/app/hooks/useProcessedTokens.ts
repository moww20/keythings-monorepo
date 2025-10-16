import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import type { ProcessedToken } from '../lib/token-utils';
import { processTokenForDisplay } from '../lib/token-utils';

/**
 * Reusable hook for fetching processed tokens from wallet
 * Follows the same pattern as the Dashboard/Assets page
 */
export function useProcessedTokens() {
  const { 
    tokens, 
    isTokensLoading, 
    isTokensFetching, 
    tokensError,
    refreshWallet 
  } = useWallet();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const refreshTokens = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await refreshWallet();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshWallet, isRefreshing]);
  
  return {
    tokens,
    isLoading: isTokensLoading || isTokensFetching,
    error: tokensError,
    refreshTokens,
    isRefreshing
  };
}
