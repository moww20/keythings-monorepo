/**
 * Token Metadata Hook
 * Centralized hook for fetching token metadata from blockchain
 * Uses window.keeta SDK calls (getBaseToken + getAccountState) as the source of truth
 */

import { useState, useEffect, useCallback } from 'react';
import { getAccountState as sdkGetAccountState } from '@/lib/explorer/sdk-read-client';
import { z } from 'zod';

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

// Zod schemas for provider responses
const AccountStateSchema = z
  .object({
    account: z.string().optional().nullable(),
    info: z
      .object({
        name: z.string().optional().nullable(),
        symbol: z.string().optional().nullable(),
        ticker: z.string().optional().nullable(),
        metadata: z.string().optional().nullable(),
        supply: z.union([z.string(), z.number(), z.bigint()]).optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .passthrough();
type AccountState = z.infer<typeof AccountStateSchema>;

export function useTokenMetadata(tokenAddress: string): UseTokenMetadataResult {
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetadata = useCallback(async () => {
    if (!tokenAddress) {
      setMetadata(null);
      setError(null);
      return;
    }

    const provider: any = typeof window !== 'undefined' ? (window as any).keeta : null;

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
      // Handle base token by resolving its address first, then fetching state
      let targetAddress = tokenAddress;
      if (tokenAddress === 'base') {
        try {
          const base = await provider?.getBaseToken?.();
          const baseAddr = base && typeof base === 'object' && base.address ? String(base.address) : null;
          if (baseAddr) {
            targetAddress = baseAddr;
          }
        } catch {}
      }

      // Read-first strategy: use SDK state, fallback to wallet provider
      let rawState: unknown = null;
      try {
        rawState = await sdkGetAccountState(targetAddress);
      } catch {}
      if (!rawState) {
        if (typeof provider?.getAccountState === 'function') {
          rawState = await provider.getAccountState(targetAddress);
        } else if (typeof provider?.request === 'function') {
          rawState = await provider.request({ method: 'keeta_getAccountState', params: [targetAddress] });
        }
      }

      const parsed = AccountStateSchema.safeParse(rawState);
      if (!parsed.success) {
        setMetadata(null);
        setError('Invalid token state response');
        return;
      }

      const info = (parsed.data as AccountState).info ?? undefined;
      const meta = info?.metadata ?? undefined;
      if (!meta) {
        setMetadata(null);
        setError('Token metadata not found');
        return;
      }

      const { decimals, fieldType } = extractDecimalsAndFieldTypeFromMetadata(meta);
      const result: TokenMetadata = {
        decimals,
        fieldType,
        name: info?.name ?? undefined,
        symbol: info?.symbol ?? undefined,
        ticker: info?.ticker ?? undefined,
        metadata: meta ?? undefined,
      };

      metadataCache.set(tokenAddress, result);
      setMetadata(result);
      setError(null);
      return;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch token metadata';
      console.warn('[useTokenMetadata] Error fetching metadata:', errorMessage);
      setError(errorMessage);
      setMetadata(null);
    } finally {
      setLoading(false);
      loadingStates.set(tokenAddress, false);
    }
  }, [tokenAddress]);

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
