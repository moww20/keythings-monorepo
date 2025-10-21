import { useCallback, useEffect, useState } from 'react';
import { processTokenForDisplay } from '@/app/lib/token-utils';

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
      
      // Resolve base token address for consistent KTA handling
      let baseTokenAddress: string | null = null;
      try {
        const baseToken = await (keeta as any).getBaseToken?.();
        if (baseToken && typeof baseToken === 'object' && baseToken !== null && 'address' in baseToken) {
          baseTokenAddress = String((baseToken as any).address);
        }
      } catch {
        baseTokenAddress = null;
      }
      
      // Request read and transact capabilities first
      if (keeta.requestCapabilities) {
        console.log('[EXPLORER_DATA] Requesting read and transact capabilities for account info...');
        await keeta.requestCapabilities(['read', 'transact']);
      }
      
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
      let isCurrent = false; // Declare isCurrent outside the try block
      
      try {
        console.log('[EXPLORER_DATA] Attempting to get connected accounts...');
        const connectedAccounts = await keeta.getAccounts?.();
        console.log('[EXPLORER_DATA] Connected accounts:', connectedAccounts);
        
        isCurrent = Array.isArray(connectedAccounts) && connectedAccounts.includes(publicKey);
        console.log('[EXPLORER_DATA] Is current account:', isCurrent);
        
        // Only try to get balances if this is the currently connected account
        if (isCurrent && keeta.getAllBalances) {
          console.log('[EXPLORER_DATA] Getting balances for connected account...');
          try {
            // Request read and transact capabilities first
            if (keeta.requestCapabilities) {
              console.log('[EXPLORER_DATA] Requesting read and transact capabilities...');
              await keeta.requestCapabilities(['read', 'transact']);
            }
            
            let balances: any = [];
            try {
              if (typeof (keeta as any).getNormalizedBalances === 'function') {
                balances = await (keeta as any).getNormalizedBalances();
              } else if (typeof keeta.request === 'function') {
                balances = await keeta.request({ method: 'keeta_getNormalizedBalances' });
              } else {
                balances = await keeta.getAllBalances();
              }
            } catch (normErr) {
              console.debug('[EXPLORER_DATA] Normalized RPC failed, falling back to getAllBalances:', normErr);
              balances = await keeta.getAllBalances();
            }
            console.log('[EXPLORER_DATA] Raw balances:', balances);

            if (Array.isArray(balances)) {
              const processed = await Promise.all(
                balances.map(async (entry: any) => {
                  const tokenAddress = String(entry?.token ?? '');
                  const rawBalance = entry?.balance ?? '0';
                  const metadata = typeof entry?.metadata === 'string' ? entry.metadata : undefined;
                  if (entry && typeof entry === 'object' && 'formattedAmount' in entry) {
                    return {
                      publicKey: tokenAddress,
                      name: typeof entry.name === 'string' && entry.name.trim().length > 0 ? entry.name : null,
                      ticker: typeof entry.ticker === 'string' && entry.ticker.trim().length > 0 ? entry.ticker : null,
                      decimals: entry.decimals ?? null,
                      fieldType: entry.fieldType,
                      formattedAmount: entry.formattedAmount,
                      icon: entry.icon ?? null,
                      totalSupply: null,
                      balance: String(rawBalance),
                    };
                  }
                  try {
                    const p = await processTokenForDisplay(
                      tokenAddress,
                      rawBalance,
                      metadata,
                      baseTokenAddress ?? undefined,
                      undefined,
                    );
                    return {
                      publicKey: tokenAddress,
                      name: p.name?.trim().length > 0 ? p.name : null,
                      ticker: p.ticker?.trim().length > 0 ? p.ticker : null,
                      decimals: p.decimals,
                      fieldType: p.fieldType,
                      formattedAmount: p.formattedAmount,
                      icon: p.icon || null,
                      totalSupply: null,
                      balance: String(rawBalance),
                    };
                  } catch {
                    return {
                      publicKey: tokenAddress,
                      name: null,
                      ticker: null,
                      decimals: null,
                      totalSupply: null,
                      balance: String(rawBalance),
                    };
                  }
                })
              );
              tokens = processed;
              console.log('[EXPLORER_DATA] Processed tokens:', tokens);
            }
          } catch (balanceError) {
            console.log('[EXPLORER_DATA] Error getting balances:', balanceError);
            // Continue without balance data - this is expected for non-connected accounts
          }
        }
        
        if (tokens.length === 0) {
          try {
            if (keeta.requestCapabilities) {
              await keeta.requestCapabilities(['read']);
            }
            if (typeof keeta.request === 'function') {
              const balances = await keeta.request({ method: 'keeta_getBalancesForAccount', params: [publicKey] });
              if (Array.isArray(balances)) {
                const processed = await Promise.all(
                  balances.map(async (entry: any) => {
                    const tokenAddress = String(entry?.token ?? '');
                    const rawBalance = entry?.balance ?? '0';
                    const metadata = typeof entry?.metadata === 'string' ? entry.metadata : undefined;
                    if (entry && typeof entry === 'object' && 'formattedAmount' in entry) {
                      return {
                        publicKey: tokenAddress,
                        name: typeof entry.name === 'string' && entry.name.trim().length > 0 ? entry.name : null,
                        ticker: typeof entry.ticker === 'string' && entry.ticker.trim().length > 0 ? entry.ticker : null,
                        decimals: entry.decimals ?? null,
                        fieldType: entry.fieldType,
                        formattedAmount: entry.formattedAmount,
                        icon: entry.icon ?? null,
                        totalSupply: null,
                        balance: String(rawBalance),
                      };
                    }
                    try {
                      const p = await processTokenForDisplay(
                        tokenAddress,
                        rawBalance,
                        metadata,
                        baseTokenAddress ?? undefined,
                        undefined,
                      );
                      return {
                        publicKey: tokenAddress,
                        name: p.name || null,
                        ticker: p.ticker || null,
                        decimals: p.decimals,
                        fieldType: p.fieldType,
                        formattedAmount: p.formattedAmount,
                        icon: p.icon || null,
                        totalSupply: null,
                        balance: String(rawBalance),
                      };
                    } catch {
                      return {
                        publicKey: tokenAddress,
                        name: null,
                        ticker: null,
                        decimals: null,
                        totalSupply: null,
                        balance: String(rawBalance),
                      };
                    }
                  })
                );
                tokens = processed;
                console.log('[EXPLORER_DATA] Tokens from wallet RPC:', tokens);
              }
            }
          } catch (error) {
            console.log('[EXPLORER_DATA] Error getting balances for account via wallet:', error);
          }
        }
      } catch (error) {
        console.log('[EXPLORER_DATA] Error enriching with balances:', error);
        // best-effort enrichment only
      }

      // Try to get transaction history for any account
      let activity: any[] = [];
      try {
        console.log('[EXPLORER_DATA] Attempting to get transaction history...');
        if (isCurrent && keeta.history && typeof keeta.history === 'function') {
          // Request read and transact capabilities for history
          if (keeta.requestCapabilities) {
            console.log('[EXPLORER_DATA] Requesting read and transact capabilities for history...');
            await keeta.requestCapabilities(['read', 'transact']);
          }
          const historyResult = await keeta.history({ depth: 25 });
          console.log('[EXPLORER_DATA] History result (current):', historyResult);
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
            console.log('[EXPLORER_DATA] Processed activity (current):', activity);
          }
        } else {
          // Public account path via wallet RPC
          console.log('[EXPLORER_DATA] Fetching public account history via wallet RPC...');
          if (keeta.requestCapabilities) {
            await keeta.requestCapabilities(['read']);
          }
          if (typeof keeta.request === 'function') {
            const data = await keeta.request({ method: 'keeta_getHistoryForAccount', params: [publicKey, { depth: 25 }] });
            if (data && typeof data === 'object' && data !== null && Array.isArray((data as any).records)) {
              activity = (data as any).records;
            }
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
