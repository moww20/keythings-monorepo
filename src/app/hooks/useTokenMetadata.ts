/**
 * Token Metadata Hook
 * Centralized hook for fetching token metadata from blockchain
 * Uses wallet provider's getTokenMetadata() as the authoritative source
 */

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/app/contexts/WalletContext';

export interface TokenMetadata {
  decimals: number;
  fieldType: 'decimalPlaces' | 'decimals';
  name?: string;
  symbol?: string;
  ticker?: string;
  metadata?: string;
}

interface UseTokenMetadataResult {
  metadata: TokenMetadata | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Cache to avoid repeated fetches
const metadataCache = new Map<string, TokenMetadata>();
const loadingStates = new Map<string, boolean>();

export function useTokenMetadata(tokenAddress: string): UseTokenMetadataResult {
  const { userClient, publicKey } = useWallet();
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetadata = useCallback(async () => {
    if (!tokenAddress || !userClient || !publicKey) {
      setMetadata(null);
      setError('Wallet not connected');
      return;
    }

    // Check cache first
    const cached = metadataCache.get(tokenAddress);
    if (cached) {
      setMetadata(cached);
      setError(null);
      return;
    }

    // Prevent duplicate requests
    if (loadingStates.get(tokenAddress)) {
      return;
    }

    setLoading(true);
    setError(null);
    loadingStates.set(tokenAddress, true);

    try {
      console.log('[useTokenMetadata] Fetching metadata for:', tokenAddress);
      
      // Handle base token specially
      if (tokenAddress === 'base' || tokenAddress === (userClient.baseToken as any)?.publicKeyString) {
        // Get base token metadata from client
        const baseTokenInfo = userClient.baseToken;
        if (baseTokenInfo && typeof baseTokenInfo === 'object' && 'info' in baseTokenInfo) {
          const info = (baseTokenInfo as any).info;
          const metadata = info?.metadata;
          
          if (metadata) {
            // Parse metadata using wallet extension pattern
            const { decimals, fieldType } = extractDecimalsAndFieldTypeFromMetadata(metadata);
            const result: TokenMetadata = {
              decimals,
              fieldType,
              name: info.name || 'KTA',
              symbol: info.symbol || 'KTA',
              ticker: info.ticker || 'KTA',
              metadata
            };
            
            metadataCache.set(tokenAddress, result);
            setMetadata(result);
            return;
          }
        }
      }

      // For regular tokens, use getTokenMetadata if available
      if ('getTokenMetadata' in userClient && typeof userClient.getTokenMetadata === 'function') {
        const fetchedMetadata = await userClient.getTokenMetadata(tokenAddress);
        
        if (fetchedMetadata) {
          const { decimals, fieldType } = extractDecimalsAndFieldTypeFromMetadata(fetchedMetadata.metadata);
          const result: TokenMetadata = {
            decimals,
            fieldType,
            name: fetchedMetadata.name,
            symbol: fetchedMetadata.symbol,
            ticker: fetchedMetadata.ticker,
            metadata: fetchedMetadata.metadata
          };
          
          metadataCache.set(tokenAddress, result);
          setMetadata(result);
          return;
        }
      }

      // Fallback: try to get from account state if available
      if ('getAccountState' in userClient && typeof userClient.getAccountState === 'function') {
        try {
          const accountState = await userClient.getAccountState(tokenAddress);
          if (accountState?.info?.metadata) {
            const { decimals, fieldType } = extractDecimalsAndFieldTypeFromMetadata(accountState.info.metadata);
            const result: TokenMetadata = {
              decimals,
              fieldType,
              name: accountState.info.name,
              symbol: accountState.info.symbol,
              ticker: accountState.info.ticker,
              metadata: accountState.info.metadata
            };
            
            metadataCache.set(tokenAddress, result);
            setMetadata(result);
            return;
          }
        } catch (accountError) {
          console.warn('[useTokenMetadata] Account state fetch failed:', accountError);
        }
      }

      // If all methods fail, throw error
      throw new Error('Unable to fetch token metadata from blockchain');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch token metadata';
      console.error('[useTokenMetadata] Error fetching metadata:', errorMessage);
      setError(errorMessage);
      setMetadata(null);
    } finally {
      setLoading(false);
      loadingStates.set(tokenAddress, false);
    }
  }, [tokenAddress, userClient, publicKey]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  return {
    metadata,
    loading,
    error,
    refetch: fetchMetadata
  };
}

/**
 * Extract decimals and field type from token metadata
 * Matches wallet extension implementation
 */
function extractDecimalsAndFieldTypeFromMetadata(metadata?: string): {
  decimals: number;
  fieldType: 'decimalPlaces' | 'decimals';
} {
  if (!metadata) {
    return { decimals: 0, fieldType: 'decimals' };
  }

  try {
    const metadataJson = atob(metadata);
    const parsed = JSON.parse(metadataJson);
    
    if (typeof parsed !== 'object' || parsed === null) {
      return { decimals: 0, fieldType: 'decimals' };
    }

    // Check decimalPlaces first (higher priority)
    const decimalPlaces = typeof parsed.decimalPlaces === 'number' && Number.isFinite(parsed.decimalPlaces)
      ? Math.max(0, Math.trunc(parsed.decimalPlaces))
      : null;
    
    if (decimalPlaces !== null && decimalPlaces >= 0) {
      return { decimals: decimalPlaces, fieldType: 'decimalPlaces' };
    }

    // Fallback to decimals
    const decimals = typeof parsed.decimals === 'number' && Number.isFinite(parsed.decimals)
      ? Math.max(0, Math.trunc(parsed.decimals))
      : null;
    
    if (decimals !== null && decimals >= 0) {
      return { decimals, fieldType: 'decimals' };
    }

    return { decimals: 0, fieldType: 'decimals' };
  } catch (error) {
    console.warn('[useTokenMetadata] Failed to parse metadata:', error);
    return { decimals: 0, fieldType: 'decimals' };
  }
}

/**
 * Clear metadata cache (useful for testing or when tokens are updated)
 */
export function clearTokenMetadataCache(): void {
  metadataCache.clear();
  loadingStates.clear();
}

/**
 * Get cached metadata without triggering a fetch
 */
export function getCachedTokenMetadata(tokenAddress: string): TokenMetadata | null {
  return metadataCache.get(tokenAddress) || null;
}
