import { useCallback, useEffect, useState } from 'react';
import { getAccountState, getHistory } from '@/lib/explorer/sdk-read-client';
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
      console.log("[useExplorerData] SIMPLIFIED: fetchAccountInfo called with publicKey:", publicKey);
    }
    const keeta = typeof window !== 'undefined' ? (window as any).keeta : null;

    try {
      // Resolve base token address for consistent KTA handling
      let baseTokenAddress: string | null = null;
      try {
        const baseToken = await (keeta as any)?.getBaseToken?.();
        if (baseToken && typeof baseToken === 'object' && baseToken !== null && 'address' in baseToken) {
          baseTokenAddress = String((baseToken as any).address);
        }
      } catch {
        baseTokenAddress = null;
      }
      
      // Best-effort: fetch account info via SDK first, fallback to wallet
      let accountInfo: unknown = await getAccountState(publicKey);
      if (!accountInfo && keeta?.getAccountInfo) {
        try {
          const maybe = await keeta.getAccountInfo(publicKey);
          accountInfo = maybe ?? null;
        } catch {}
      }
      
      if (!accountInfo) {
        return null;
      }

      // Transform the wallet extension response to our ExplorerAccount format
      const account = accountInfo as any; // Type assertion since we don't know the exact structure

      // Try to enrich with balances - attempt for both current account and queried account
      let tokens: ExplorerAccount["tokens"] = [];
      let isCurrent = false; // Declare isCurrent outside the try block
      
      try {
        const connectedAccounts = await keeta?.getAccounts?.();
        
        isCurrent = Array.isArray(connectedAccounts) && connectedAccounts.includes(publicKey);
        
        // Only try to get balances if this is the currently connected account (wallet path)
        if (isCurrent && keeta?.getAllBalances) {
          try {
            let balances: any = [];
            try {
              if (typeof (keeta as any).getNormalizedBalances === 'function') {
                balances = await (keeta as any).getNormalizedBalances();
              } else if (typeof keeta.request === 'function') {
                balances = await keeta.request({ method: 'keeta_getNormalizedBalances' });
              } else {
                balances = await keeta.getAllBalances();
              }
            } catch {
              balances = await keeta.getAllBalances();
            }

            if (Array.isArray(balances)) {
              tokens = await processBalancesEntries(balances, baseTokenAddress);
            }
          } catch {
          }
        }

        if (tokens.length === 0) {
          // SDK fallback: attempt to extract balances from account state if available
          try {
            const raw = await getAccountState(publicKey);
            const obj = (raw && typeof raw === 'object') ? (raw as any) : {};
            const candidate = Array.isArray(obj?.tokens) ? obj.tokens : Array.isArray(obj?.balances) ? obj.balances : [];
            if (Array.isArray(candidate)) {
              tokens = await processBalancesEntries(candidate, baseTokenAddress);
            }
          } catch {}
        }
      } catch {
        // best-effort enrichment only
      }

      // Get transaction history via SDK first, fallback to wallet extension
      let activity: any[] = [];
      try {
        const sdkHistory: any = await getHistory({ depth: 25, cursor: null });
        const sdkRecords = (sdkHistory && Array.isArray(sdkHistory)) ? sdkHistory : (sdkHistory?.records ?? []);
        if (Array.isArray(sdkRecords) && sdkRecords.length) {
          activity = mapHistoryRecords(sdkRecords);
        } else if (keeta?.history && typeof keeta.history === 'function') {
          const historyResult = await keeta.history({ depth: 25, includeTokenMetadata: true } as any);
          const records = historyResult?.records || historyResult;
          if (Array.isArray(records)) {
            activity = mapHistoryRecords(records);
          }
        }
      } catch {
        // Continue without activity data
      }

      // Return the simplified account data
      return {
        publicKey: account.publicKey || publicKey,
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
    } catch (error) {
      console.error('[useExplorerData] Error fetching account info:', error);
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
    }
  }, [fetchAccountInfo]);

  return {
    account: state.account,
    loading: state.loading,
    error: state.error,
    fetchAccount,
  };
}