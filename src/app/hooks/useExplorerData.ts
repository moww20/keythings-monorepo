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
    try { console.debug('[useExplorerData] fetchAccountInfo:start', { publicKey }); } catch {}
    // SDK-only path: do not use wallet provider endpoints

    try {
      // Detect base token from environment
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
          try { console.debug('[useExplorerData] baseTokenAddress(provider)', { baseTokenAddress }); } catch {}
        } catch {}
      }
      try { console.debug('[useExplorerData] baseTokenAddress', { baseTokenAddress }); } catch {}
      
      // Fetch account state directly from SDK (may be null for accounts with no on-chain state yet)
      const accountState: unknown = await getAccountState(publicKey);
      try {
        const hasState = !!(accountState && typeof accountState === 'object');
        const balancesLen = hasState && Array.isArray((accountState as any)?.balances) ? (accountState as any).balances.length : 0;
        const tokensLen = hasState && Array.isArray((accountState as any)?.tokens) ? (accountState as any).tokens.length : 0;
        console.debug('[useExplorerData] accountState:summary', { hasState, balancesLen, tokensLen });
      } catch {}
      
      // Build a minimal account object even if no state exists, so the page still renders for arbitrary keys
      const account = (accountState && typeof accountState === 'object') ? (accountState as any) : {};

      // Enrich with balances via SDK
      let tokens: ExplorerAccount["tokens"] = [];
      try {
        // Primary: aggregate balances across owner + storage accounts using SDK
        const agg = await getAggregatedBalancesForOwner(publicKey, { maxStorages: 25, includeTokenMetadata: true });
        try { console.debug('[useExplorerData] aggregatedBalances:raw', agg); } catch {}
        if (Array.isArray(agg) && agg.length) {
          tokens = await processBalancesEntries(agg, baseTokenAddress);
          try { console.debug('[useExplorerData] aggregatedBalances:processed', tokens); } catch {}
        }
        // Fallback: use raw SDK state balances
        if (tokens.length === 0) {
          const raw = await getAccountState(publicKey);
          const obj = (raw && typeof raw === 'object') ? (raw as any) : {};
          const candidate = Array.isArray(obj?.tokens) ? obj.tokens : Array.isArray(obj?.balances) ? obj.balances : [];
          if (Array.isArray(candidate)) {
            tokens = await processBalancesEntries(candidate, baseTokenAddress);
            try { console.debug('[useExplorerData] fallbackBalances:processed', tokens); } catch {}
          }
        }
      } catch {
        // best-effort enrichment only
      }

      // Get transaction history filtered for the queried account
      let activity: any[] = [];
      try {
        const perAccount = await getHistoryForAccount(publicKey, { depth: 25, includeTokenMetadata: true });
        if (Array.isArray(perAccount) && perAccount.length) {
          activity = mapHistoryRecords(perAccount as any[]);
        }
      } catch {}

      // Return the simplified account data
      const result = {
        publicKey,
        type: account.type || 'account',
        representative: account.representative || null,
        owner: account.owner || null,
        signers: account.signers || [],
        headBlock: account.headBlock || null,
        info: account.info || {},
        tokens,
        certificates: account.certificates || [],
        activity,
      };
      try { console.debug('[useExplorerData] fetchAccountInfo:done', { publicKey, tokens: result.tokens.length, activity: result.activity.length }); } catch {}
      return result;
    } catch (error) {
      try { console.error('[useExplorerData] fetchAccountInfo:error', error); } catch {}
      throw error;
    }
  }, []);

  const fetchAccount = useCallback(async (publicKey: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try { console.debug('[useExplorerData] fetchAccount:start', { publicKey }); } catch {}
    
    try {
      const account = await fetchAccountInfo(publicKey);
      setState(prev => ({ ...prev, account, loading: false, error: null }));
      try { console.debug('[useExplorerData] fetchAccount:success', { hasAccount: !!account }); } catch {}
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