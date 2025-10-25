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
    if (typeof window === 'undefined' || !window.keeta) {
      throw new Error('Keeta wallet not available');
    }

    const keeta = window.keeta;
    
    if (!keeta || !keeta.getAccountInfo) {
      throw new Error('Keeta wallet not available or getAccountInfo method not supported');
    }

    try {
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
        await keeta.requestCapabilities(['read', 'transact']);
      }
      
      // Use the wallet extension to get account info
      const accountInfo = await keeta.getAccountInfo(publicKey);
      
      if (!accountInfo) {
        return null;
      }

      // Transform the wallet extension response to our ExplorerAccount format
      const account = accountInfo as any; // Type assertion since we don't know the exact structure

      // Try to enrich with balances - attempt for both current account and queried account
      let tokens: ExplorerAccount["tokens"] = [];
      let isCurrent = false; // Declare isCurrent outside the try block
      
      try {
        const connectedAccounts = await keeta.getAccounts?.();
        
        isCurrent = Array.isArray(connectedAccounts) && connectedAccounts.includes(publicKey);
        
        // Only try to get balances if this is the currently connected account
        if (isCurrent && keeta.getAllBalances) {
          try {
            // Request read and transact capabilities first
            if (keeta.requestCapabilities) {
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
            } catch {
              balances = await keeta.getAllBalances();
            }

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
            }
          } catch {
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
              }
            }
          } catch {
            // Continue without balance data - this is expected for non-connected accounts
          }
        }
      } catch {
        // best-effort enrichment only
      }

      // SIMPLIFIED: Get transaction history directly from wallet extension
      let activity: any[] = [];
      try {
        if (process.env.NODE_ENV === "development") {
          console.log("[useExplorerData] SIMPLIFIED: Getting history directly from wallet extension");
        }
        
        // Use wallet extension history directly - no complex processing
        if (keeta.history && typeof keeta.history === 'function') {
          const historyResult = await keeta.history({ depth: 25, includeTokenMetadata: true } as any);
          
          if (process.env.NODE_ENV === "development") {
            console.log("[useExplorerData] SIMPLIFIED: Raw wallet extension data:", {
              historyResult,
              firstRecord: historyResult?.records?.[0],
              firstRecordKeys: historyResult?.records?.[0] ? Object.keys(historyResult.records[0]) : [],
            });
          }
          
          // SIMPLIFIED: Use raw data directly without complex processing
          const records = historyResult?.records || historyResult;
          if (Array.isArray(records)) {
            activity = records.map((record: any, index: number) => ({
              id: record.id || record.block || `activity-${index}`,
              block: record.block || record.id || '',
              timestamp: record.timestamp || Date.now(),
              type: record.type || 'UNKNOWN',
              amount: record.amount || '0',
              from: record.from || '',
              to: record.to || '',
              token: record.token || '',
              operationType: record.type || 'UNKNOWN',
              formattedAmount: record.amount || '0',
              rawAmount: record.amount || '0',
              tokenTicker: record.tokenTicker || 'UNKNOWN',
              tokenDecimals: record.tokenDecimals || null,
              tokenMetadata: record.tokenMetadata || null,
            }));
            
            if (process.env.NODE_ENV === "development") {
              console.log("[useExplorerData] SIMPLIFIED: Processed activity:", {
                activityLength: activity.length,
                firstActivity: activity[0],
                firstActivityKeys: activity[0] ? Object.keys(activity[0]) : [],
              });
            }
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