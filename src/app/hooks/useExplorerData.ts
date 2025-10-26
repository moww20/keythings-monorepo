import { useCallback, useEffect, useState } from 'react';
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
    if (process.env.NODE_ENV === "development") {
      console.debug("[useExplorerData] fetchAccountInfo:start", { publicKey });
    }
    // SDK-only path: do not use wallet provider endpoints

    try {
      // Base token not required for SDK-only enrichment
      const baseTokenAddress: string | null = null;
      
      // Fetch account state directly from SDK (may be null for accounts with no on-chain state yet)
      const accountState: unknown = await getAccountState(publicKey);
      if (process.env.NODE_ENV === "development") {
        const hasState = !!(accountState && typeof accountState === 'object');
        const balancesLen = hasState && Array.isArray((accountState as any)?.balances) ? (accountState as any).balances.length : 0;
        const tokensLen = hasState && Array.isArray((accountState as any)?.tokens) ? (accountState as any).tokens.length : 0;
        console.debug("[useExplorerData] accountState", { hasState, balancesLen, tokensLen });
      }
      
      // Build a minimal account object even if no state exists, so the page still renders for arbitrary keys
      const account = (accountState && typeof accountState === 'object') ? (accountState as any) : {};

      // Enrich with balances via SDK
      let tokens: ExplorerAccount["tokens"] = [];
      try {
        // Primary: aggregate balances across owner + storage accounts using SDK
        if (process.env.NODE_ENV === "development") {
          console.debug("[useExplorerData] aggregatedBalances:request", { publicKey });
        }
        const agg = await getAggregatedBalancesForOwner(publicKey, { maxStorages: 25, includeTokenMetadata: true });
        if (Array.isArray(agg) && agg.length) {
          tokens = await processBalancesEntries(agg, baseTokenAddress);
          if (process.env.NODE_ENV === "development") {
            console.debug("[useExplorerData] aggregatedBalances:success", { count: agg.length });
          }
        }
        // Fallback: use raw SDK state balances
        if (tokens.length === 0) {
          const raw = await getAccountState(publicKey);
          const obj = (raw && typeof raw === 'object') ? (raw as any) : {};
          const candidate = Array.isArray(obj?.tokens) ? obj.tokens : Array.isArray(obj?.balances) ? obj.balances : [];
          if (Array.isArray(candidate)) {
            tokens = await processBalancesEntries(candidate, baseTokenAddress);
            if (process.env.NODE_ENV === "development") {
              console.debug("[useExplorerData] fallbackBalances:success", { count: candidate.length });
            }
          }
        }
      } catch {
        // best-effort enrichment only
      }

      // Get transaction history filtered for the queried account
      let activity: any[] = [];
      try {
        if (process.env.NODE_ENV === "development") {
          console.debug("[useExplorerData] history:request", { publicKey });
        }
        const perAccount = await getHistoryForAccount(publicKey, { depth: 25, includeTokenMetadata: true });
        if (Array.isArray(perAccount) && perAccount.length) {
          activity = mapHistoryRecords(perAccount as any[]);
          if (process.env.NODE_ENV === "development") {
            console.debug("[useExplorerData] history:success", { count: perAccount.length });
          }
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
      if (process.env.NODE_ENV === "development") {
        console.debug("[useExplorerData] fetchAccountInfo:done", { publicKey, tokens: result.tokens.length, activity: result.activity.length });
      }
      return result;
    } catch (error) {
      console.error('[useExplorerData] Error fetching account info:', error);
      throw error;
    }
  }, []);

  const fetchAccount = useCallback(async (publicKey: string) => {
    if (process.env.NODE_ENV === "development") {
      console.debug("[useExplorerData] fetchAccount:start", { publicKey });
    }
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const account = await fetchAccountInfo(publicKey);
      setState(prev => ({ ...prev, account, loading: false, error: null }));
      if (process.env.NODE_ENV === "development") {
        console.debug("[useExplorerData] fetchAccount:success", { hasAccount: !!account });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch account';
      setState(prev => ({ ...prev, account: null, loading: false, error: errorMessage }));
      if (process.env.NODE_ENV === "development") {
        console.error("[useExplorerData] fetchAccount:error", errorMessage);
      }
    }
  }, [fetchAccountInfo]);

  return {
    account: state.account,
    loading: state.loading,
    error: state.error,
    fetchAccount,
  };
}