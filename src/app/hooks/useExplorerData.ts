import { useCallback, useEffect, useState } from 'react';

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
    totalSupply: string | null;
    balance: string;
  }>;
  certificates: Array<{
    issuer: string | null;
    hash: string;
    issuedAt: string | null;
    expiresAt: string | null;
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
    console.log('[EXPLORER_DATA] fetchAccountInfo called with publicKey:', publicKey);
    
    if (typeof window === 'undefined' || !window.keeta) {
      console.log('[EXPLORER_DATA] Window or keeta not available');
      throw new Error('Keeta wallet not available');
    }

    const keeta = window.keeta;
    console.log('[EXPLORER_DATA] Keeta wallet object:', keeta);
    console.log('[EXPLORER_DATA] getAccountInfo method available:', !!keeta?.getAccountInfo);
    
    if (!keeta || !keeta.getAccountInfo) {
      console.log('[EXPLORER_DATA] Keeta wallet or getAccountInfo method not available');
      throw new Error('Keeta wallet not available or getAccountInfo method not supported');
    }

    try {
      console.log('[EXPLORER_DATA] Calling keeta.getAccountInfo for:', publicKey);
      // Use the wallet extension to get account info
      const accountInfo = await keeta.getAccountInfo(publicKey);
      console.log('[EXPLORER_DATA] Raw account info from wallet:', accountInfo);
      
      if (!accountInfo) {
        console.log('[EXPLORER_DATA] No account info returned from wallet');
        return null;
      }

      // Transform the wallet extension response to our ExplorerAccount format
      const account = accountInfo as any; // Type assertion since we don't know the exact structure
      console.log('[EXPLORER_DATA] Transformed account object:', account);

      // Try to enrich with balances if the queried account matches the connected account
      let tokens: ExplorerAccount["tokens"] = [];
      try {
        console.log('[EXPLORER_DATA] Attempting to get connected accounts...');
        const connectedAccounts = await keeta.getAccounts?.();
        console.log('[EXPLORER_DATA] Connected accounts:', connectedAccounts);
        
        const isCurrent = Array.isArray(connectedAccounts) && connectedAccounts.includes(publicKey);
        console.log('[EXPLORER_DATA] Is current account:', isCurrent);
        
        if (isCurrent && keeta.getAllBalances) {
          console.log('[EXPLORER_DATA] Getting balances for current account...');
          const balances = await keeta.getAllBalances();
          console.log('[EXPLORER_DATA] Raw balances:', balances);
          
          if (Array.isArray(balances)) {
            tokens = balances.map((entry: any) => {
              // Metadata may be base64-encoded JSON; decode best-effort
              let name: string | null = null;
              let ticker: string | null = null;
              let decimals: number | null = null;
              try {
                if (entry?.metadata && typeof entry.metadata === 'string') {
                  const json = JSON.parse(atob(entry.metadata));
                  name = json?.displayName ?? json?.name ?? null;
                  ticker = json?.symbol ?? json?.ticker ?? null;
                  decimals = typeof json?.decimalPlaces === 'number' ? json.decimalPlaces : (typeof json?.decimals === 'number' ? json.decimals : null);
                }
              } catch {
                // ignore metadata parse errors
              }
              return {
                publicKey: String(entry?.token ?? ''),
                name,
                ticker,
                decimals,
                totalSupply: null,
                balance: String(entry?.balance ?? '0'),
              };
            });
            console.log('[EXPLORER_DATA] Processed tokens:', tokens);
          }
        }
      } catch (error) {
        console.log('[EXPLORER_DATA] Error enriching with balances:', error);
        // best-effort enrichment only
      }

      const result = {
        publicKey: account.publicKey || publicKey,
        type: account.type || 'ACCOUNT',
        representative: account.representative || null,
        owner: account.owner || null,
        signers: account.signers || [],
        headBlock: account.headBlock || null,
        info: account.info || {},
        tokens: tokens.length > 0 ? tokens : (account.tokens || []),
        certificates: account.certificates || [],
      };
      
      console.log('[EXPLORER_DATA] Final result:', result);
      return result;
    } catch (error) {
      console.error('[EXPLORER_DATA] Error fetching account info:', error);
      throw error;
    }
  }, []);

  const fetchAccount = useCallback(async (publicKey: string) => {
    console.log('[EXPLORER_DATA] fetchAccount called with publicKey:', publicKey);
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      console.log('[EXPLORER_DATA] Calling fetchAccountInfo...');
      const account = await fetchAccountInfo(publicKey);
      console.log('[EXPLORER_DATA] fetchAccountInfo returned:', account);
      
      const newState = {
        account,
        loading: false,
        error: account ? null : 'Account not found',
      };
      console.log('[EXPLORER_DATA] Setting state to:', newState);
      setState(newState);
    } catch (error) {
      console.error('[EXPLORER_DATA] Error in fetchAccount:', error);
      const newState = {
        account: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch account',
      };
      console.log('[EXPLORER_DATA] Setting error state to:', newState);
      setState(newState);
    }
  }, [fetchAccountInfo]);

  const clearData = useCallback(() => {
    setState({
      account: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    fetchAccount,
    clearData,
  };
}
