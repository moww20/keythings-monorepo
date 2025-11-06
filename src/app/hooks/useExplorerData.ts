import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { getAccountState, getHistoryForAccount, getAggregatedBalancesForOwner } from '@/lib/explorer/sdk-read-client';
import { processBalancesEntries, mapHistoryRecords } from '@/lib/explorer/mappers';

interface ExplorerAccount {
  publicKey: string;
  type: string;
  representative: string | null;
  owner: string | null;
  signers: string[];
  headBlock: string | null;
  info: Record<string, unknown>;
  tokens: Array<{
    publicKey: string;
    name: string | null;
    ticker: string | null;
    decimals: number | null;
    fieldType?: 'decimalPlaces' | 'decimals';
    formattedAmount?: string;
    icon?: string | null;
    totalSupply: string | null;
    balance: string;
  }>;
  certificates: Array<{
    issuer: string | null;
    hash: string;
    issuedAt: string | null;
    expiresAt: string | null;
  }>;
  activity: Array<{
    id: string;
    block: string;
    timestamp: number;
    type: string;
    amount: string;
    from: string;
    to: string;
    token: string;
    operationType: string;
    formattedAmount?: string;
    rawAmount?: string;
    tokenTicker?: string | null;
    tokenDecimals?: number | null;
    tokenMetadata?: {
      name?: string | null;
      ticker?: string | null;
      decimals?: number | null;
    } | null;
  }>;
}

interface ExplorerDataState {
  account: ExplorerAccount | null;
  loading: boolean;
  error: string | null;
}

export function useExplorerData() {
  const [state, setState] = useState<ExplorerDataState>({
    account: null,
    loading: false,
    error: null,
  });

  const fetchAccountInfo = useCallback(async (publicKey: string): Promise<ExplorerAccount | null> => {
    // SDK-only path: do not use wallet provider endpoints

    try {
      const aggregatedBalancesPromise = getAggregatedBalancesForOwner(publicKey, {
        maxStorages: 25,
        includeTokenMetadata: true,
      });
      const historyPromise = getHistoryForAccount(publicKey, { depth: 25, includeTokenMetadata: true });
      const accountStatePromise = getAccountState(publicKey);

      // Detect base token from environment while other requests are in-flight
      const EnvSchema = z.object({ NEXT_PUBLIC_KTA_TOKEN_PUBKEY: z.string().optional() });
      const env = EnvSchema.safeParse(process.env);
      let baseTokenAddress: string | null = env.success && env.data.NEXT_PUBLIC_KTA_TOKEN_PUBKEY && env.data.NEXT_PUBLIC_KTA_TOKEN_PUBKEY.trim().length
        ? env.data.NEXT_PUBLIC_KTA_TOKEN_PUBKEY.trim()
        : null;
      if (!baseTokenAddress && typeof window !== 'undefined' && (window as any)?.keeta?.getBaseToken) {
        try {
          const base = await (window as any).keeta.getBaseToken();
          const addr = base && typeof base === 'object' && base !== null && 'address' in base ? (base as any).address : undefined;
          baseTokenAddress = typeof addr === 'string' && addr.trim().length ? addr.trim() : baseTokenAddress;
        } catch {}
      }

      const accountState: unknown = await accountStatePromise;
      try {
        const hasState = !!(accountState && typeof accountState === 'object');
        const balancesLen = hasState && Array.isArray((accountState as any)?.balances) ? (accountState as any).balances.length : 0;
        const tokensLen = hasState && Array.isArray((accountState as any)?.tokens) ? (accountState as any).tokens.length : 0;

      } catch {}

      const account = (accountState && typeof accountState === 'object') ? (accountState as any) : {};

      const [aggregatedResult, historyResult] = await Promise.allSettled([
        aggregatedBalancesPromise,
        historyPromise,
      ]);

      let tokens: ExplorerAccount["tokens"] = [];
      if (aggregatedResult.status === 'fulfilled' && Array.isArray(aggregatedResult.value) && aggregatedResult.value.length) {
        try {
          tokens = await processBalancesEntries(aggregatedResult.value, baseTokenAddress);

        } catch (processError) {

        }
      }

      if (tokens.length === 0) {
        const candidate = Array.isArray((account as any)?.tokens)
          ? (account as any).tokens
          : Array.isArray((account as any)?.balances)
            ? (account as any).balances
            : [];
        if (Array.isArray(candidate) && candidate.length) {
          try {
            tokens = await processBalancesEntries(candidate, baseTokenAddress);

          } catch (fallbackError) {

          }
        }
      }

      let activity: any[] = [];
      if (historyResult.status === 'fulfilled' && Array.isArray(historyResult.value) && historyResult.value.length) {
        try {
          activity = mapHistoryRecords(historyResult.value as any[]);
        } catch (mapError) {

        }
      }

      // Determine account type - check multiple locations as per Keeta SDK structure
      // 1. Check account.type (direct property)
      // 2. Check account.info.type (nested in info object)
      // 3. Try to determine from Account object if available (isStorage method, etc.)
      let accountType: string | null = null;
      
      // First, try direct type property
      if (account.type && typeof account.type === 'string') {
        accountType = account.type.trim().toUpperCase();
      }
      
      // If not found, check info.type
      if (!accountType && account.info && typeof account.info === 'object') {
        const infoType = (account.info as any).type;
        if (infoType && typeof infoType === 'string') {
          accountType = infoType.trim().toUpperCase();
        }
      }
      
      // If still not found, try to determine from Account object if available
      // Storage accounts are generated identifiers, so we can check the account object itself
      if (!accountType) {
        try {
          const KeetaNet = await import('@keetanetwork/keetanet-client');
          const accountObj = KeetaNet.lib.Account.fromPublicKeyString(publicKey);
          
          // Check if account has type-related methods or properties
          if (typeof (accountObj as any).isStorage === 'function') {
            if ((accountObj as any).isStorage()) {
              accountType = 'STORAGE';
            }
          } else if (typeof (accountObj as any).accountType === 'string') {
            accountType = String((accountObj as any).accountType).trim().toUpperCase();
          } else if (typeof (accountObj as any).type === 'string') {
            accountType = String((accountObj as any).type).trim().toUpperCase();
          }
        } catch (accountTypeError) {
          // If Account object creation fails, continue with fallback
        }
      }
      
      // Final fallback: default to 'account' if no type found
      if (!accountType || accountType === '') {
        accountType = 'account';
      }

      const result = {
        publicKey,
        type: accountType,
        representative: account.representative || null,
        owner: account.owner || null,
        signers: account.signers || [],
        headBlock: account.headBlock || null,
        info: account.info || {},
        tokens,
        certificates: account.certificates || [],
        activity,
      };
      return result;
    } catch (error) {
      try { console.error('[useExplorerData] fetchAccountInfo:error', error); } catch {}
      throw error;
    }
  }, []);

  const fetchAccount = useCallback(async (publicKey: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const account = await fetchAccountInfo(publicKey);
      setState(prev => ({ ...prev, account, loading: false, error: null }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch account';
      setState(prev => ({ ...prev, account: null, loading: false, error: errorMessage }));
      try { console.error('[useExplorerData] fetchAccount:error', errorMessage); } catch {}
    }
  }, [fetchAccountInfo]);

  return {
    account: state.account,
    loading: state.loading,
    error: state.error,
    fetchAccount,
  };
}