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

      // Try to enrich with balances - attempt for both current account and queried account
      let tokens: ExplorerAccount["tokens"] = [];
      try {
        console.log('[EXPLORER_DATA] Attempting to get connected accounts...');
        const connectedAccounts = await keeta.getAccounts?.();
        console.log('[EXPLORER_DATA] Connected accounts:', connectedAccounts);
        
        const isCurrent = Array.isArray(connectedAccounts) && connectedAccounts.includes(publicKey);
        console.log('[EXPLORER_DATA] Is current account:', isCurrent);
        
        // Try to get balances for any account, not just the current one
        if (keeta.getAllBalances) {
          console.log('[EXPLORER_DATA] Getting balances...');
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
        
        // If no tokens from balances, try to get account-specific token info
        if (tokens.length === 0 && keeta.getAccountInfo) {
          console.log('[EXPLORER_DATA] No tokens from balances, trying account-specific info...');
          try {
            // Try to get more detailed account info that might include tokens
            const detailedInfo = await keeta.getAccountInfo(publicKey);
            console.log('[EXPLORER_DATA] Detailed account info:', detailedInfo);
            
            // Check if the account info includes token information
            if (detailedInfo && typeof detailedInfo === 'object') {
              const accountData = detailedInfo as any;
              if (accountData.tokens && Array.isArray(accountData.tokens)) {
                tokens = accountData.tokens.map((token: any) => ({
                  publicKey: String(token?.publicKey ?? token?.token ?? ''),
                  name: token?.name ?? null,
                  ticker: token?.ticker ?? token?.symbol ?? null,
                  decimals: token?.decimals ?? null,
                  totalSupply: token?.totalSupply ?? null,
                  balance: String(token?.balance ?? '0'),
                }));
                console.log('[EXPLORER_DATA] Tokens from account info:', tokens);
              }
            }
          } catch (error) {
            console.log('[EXPLORER_DATA] Error getting detailed account info:', error);
          }
        }
      } catch (error) {
        console.log('[EXPLORER_DATA] Error enriching with balances:', error);
        // best-effort enrichment only
      }

      // Try to get transaction history if available
      let activity: any[] = [];
      try {
        console.log('[EXPLORER_DATA] Attempting to get transaction history...');
        if (keeta.history && typeof keeta.history === 'function') {
          const historyResult = await keeta.history({ depth: 10 });
          console.log('[EXPLORER_DATA] History result:', historyResult);
          
          if (historyResult && Array.isArray(historyResult.records)) {
            activity = historyResult.records.map((record: any) => ({
              id: record.id || record.block || record.hash,
              block: record.block || record.hash,
              timestamp: record.timestamp || Date.now(),
              type: record.type || 'Transaction',
              amount: record.amount || '0',
              from: record.from || '',
              to: record.to || '',
              token: record.token || '',
              operationType: record.operationType || 'UNKNOWN',
            }));
            console.log('[EXPLORER_DATA] Processed activity:', activity);
          }
        }
      } catch (error) {
        console.log('[EXPLORER_DATA] Error fetching history:', error);
        // Continue without activity data
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
        activity: activity,
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
