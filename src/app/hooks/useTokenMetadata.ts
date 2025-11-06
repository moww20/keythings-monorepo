/**
 * Token Metadata Hook
 * Centralized hook for fetching token metadata from blockchain
 * Uses window.keeta SDK calls (getBaseToken + getAccountState) as the source of truth
 */

import { useState, useEffect, useCallback } from 'react';
import { getAccountState as sdkGetAccountState } from '@/lib/explorer/sdk-read-client';
import { extractDecimalsAndFieldType, getTokenDisplayName as getDisplayNameFromMeta, getTokenTicker as getTickerFromMeta } from '@/app/lib/token-utils';
import { z } from 'zod';

export interface TokenMetadata {
  decimals: number;
  fieldType: 'decimalPlaces' | 'decimals';
  displayName?: string;
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
    info: z
      .object({
        name: z.string().optional().nullable(),
        symbol: z.string().optional().nullable(),
        ticker: z.string().optional().nullable(),
        metadata: z.union([z.string(), z.record(z.string(), z.unknown())]).optional().nullable(),
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
      let meta = info?.metadata as unknown as (string | Record<string, unknown> | undefined);

      // Normalize object metadata to base64 string for unified parsing
      if (meta && typeof meta === 'object') {
        try { meta = btoa(JSON.stringify(meta)); } catch {}
      }

      // Fallback: use provider.history to retrieve tokenMetadata if missing in account state
      if (!meta && provider && typeof provider.history === 'function') {
        try {
          // Request read capability if necessary
          try { await provider.requestCapabilities?.(['read']); } catch {}
          const hist: any = await provider.history({ depth: 50, cursor: null, includeTokenMetadata: true } as any);
          const records: any[] = Array.isArray(hist?.records) ? hist.records : Array.isArray(hist) ? hist : [];
          const match = records.find((r: any) => {
            const id = (r?.token ?? r?.tokenAddress ?? r?.operation?.token);
            return typeof id === 'string' && id === tokenAddress && (r?.tokenMetadata !== undefined && r?.tokenMetadata !== null);
          });
          if (match && match.tokenMetadata) {
            const tm = match.tokenMetadata;
            if (typeof tm === 'string') {
              meta = tm;
            } else if (typeof tm === 'object') {
              try { meta = btoa(JSON.stringify(tm)); } catch {}
            }
          }
        } catch (e) {

        }
      }

      // Fallback: query provider.getAccountInfo for metadata
      if (!meta && provider && typeof provider.getAccountInfo === 'function') {
        try {
          const infoRaw: any = await provider.getAccountInfo(targetAddress);
          const InfoMetaSchema = z.object({ metadata: z.union([z.string(), z.record(z.string(), z.unknown())]).optional().nullable() }).passthrough();
          const parsedInfo = InfoMetaSchema.safeParse(infoRaw);
          if (parsedInfo.success && parsedInfo.data.metadata) {
            const m = parsedInfo.data.metadata as unknown;
            if (typeof m === 'string') {
              meta = m;
            } else if (m && typeof m === 'object') {
              try { meta = btoa(JSON.stringify(m)); } catch { meta = undefined; }
            }
          }
        } catch (e) {

        }
      }

      const metaStr: string | undefined = typeof meta === 'string' ? meta : undefined;

      const { decimals, fieldType } = extractDecimalsAndFieldTypeFromMetadata(metaStr);
      const nameFromMeta = getDisplayNameFromMeta(metaStr) || undefined;
      const tickerFromMeta = getTickerFromMeta(metaStr) || undefined;
      // Derive long displayName (prefer metadata.displayName, else info.description, else best available)
      const description = (info as any)?.description;
      const displayName = nameFromMeta
        || (typeof description === 'string' && description.trim().length > 0 ? description : undefined)
        || (typeof info?.name === 'string' && info.name.trim().length > 0 ? info.name : undefined)
        || (typeof info?.symbol === 'string' && info.symbol.trim().length > 0 ? info.symbol : undefined)
        || (typeof info?.ticker === 'string' && info.ticker.trim().length > 0 ? info.ticker : undefined);

      const name = (typeof info?.name === 'string' && info.name.trim().length > 0) ? info.name : nameFromMeta;
      const symbol = (typeof info?.symbol === 'string' && info.symbol.trim().length > 0) ? info.symbol : undefined;
      const ticker = (typeof info?.ticker === 'string' && info.ticker.trim().length > 0) ? info.ticker : tickerFromMeta;

      const result: TokenMetadata = {
        decimals,
        fieldType,
        displayName,
        name,
        symbol,
        ticker,
        metadata: metaStr,
      };

      metadataCache.set(tokenAddress, result);
      setMetadata(result);
      setError(null);
      return;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch token metadata';

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
  // Delegate to token-utils to keep one source of truth
  try {
    const { decimals, fieldType } = extractDecimalsAndFieldType(metadata);
    return { decimals, fieldType };
  } catch (error) {

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
