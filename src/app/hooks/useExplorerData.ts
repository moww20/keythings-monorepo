import { useCallback, useEffect, useState } from 'react';
import { processTokenForDisplay } from '@/app/lib/token-utils';
import { normalizeHistoryResponse, extractActivityFromSDKHistory, processKeetaHistoryWithFiltering } from '@/app/explorer/utils/history';

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
        if (isCurrent && (typeof keeta.getUserClient === 'function')) {
          // Use SDK user client for richer history (effects + voteStaple)
          if (keeta.requestCapabilities) {
            console.log('[EXPLORER_DATA] Requesting read capability for SDK history...');
            await keeta.requestCapabilities(['read']);
          }
          const userClient = await keeta.getUserClient();
          console.log('[EXPLORER_DATA] Got userClient for history:', !!userClient);
          if (userClient && typeof (userClient as any).history === 'function') {
            const uc: any = userClient;
            const sdkHistory = await uc.history({ depth: 25 });
            console.log('[EXPLORER_DATA] SDK history result:', sdkHistory);

            // Use our improved parsing function for all SDK history processing
            try {
              globalThis.console.warn('[EXPLORER_DATA] Using processKeetaHistoryWithFiltering for SDK history');
              activity = processKeetaHistoryWithFiltering(sdkHistory, publicKey);
              globalThis.console.warn('[EXPLORER_DATA] processKeetaHistoryWithFiltering result:', activity);
            } catch (e) {
              console.log('[EXPLORER_DATA] SDK history parsing failed:', e);
              activity = [];
            }
            console.log('[EXPLORER_DATA] Extracted activity (SDK):', activity);
          } else if (keeta.history && typeof keeta.history === 'function') {
            // Fallback to provider history shape
            const historyResult = await keeta.history({ depth: 25, includeTokenMetadata: true } as any);
            console.log('[EXPLORER_DATA] Provider history result (fallback):', historyResult);
            // Try to use our improved parsing if the data has voteStaple structure
            if (Array.isArray(historyResult) && historyResult.some((item: any) => item.voteStaple)) {
              globalThis.console.warn('[EXPLORER_DATA] Using processKeetaHistoryWithFiltering for fallback (voteStaple detected)');
              activity = processKeetaHistoryWithFiltering(historyResult, publicKey);
            } else {
              globalThis.console.warn('[EXPLORER_DATA] Using normalizeHistoryResponse for fallback (no voteStaple)');
            activity = normalizeHistoryResponse(historyResult, publicKey);
            }
            // Enrich missing fields using SDK block lookups if available
            if (typeof keeta.getUserClient === 'function') {
              try {
                const uc = await keeta.getUserClient();
                if (uc && typeof (uc as any).block === 'function') {
                  const needsEnrichment = activity.filter(a => (!a.from && !a.to) || !a.token);
                  const uniqueBlocks = Array.from(new Set(needsEnrichment.map(a => a.block).filter(Boolean)));
                  const blockEntries = await Promise.all(uniqueBlocks.map(async (bh) => {
                    try {
                      const b = await (uc as any).block(bh);
                      return [bh, b] as const;
                    } catch {
                      return [bh, null] as const;
                    }
                  }));
                  const blockMap: Record<string, unknown> = {};
                  for (const [bh, b] of blockEntries) {
                    if (b) blockMap[bh] = b as unknown;
                  }
                  if (Object.keys(blockMap).length > 0) {
                    const { enrichActivityWithBlocks } = await import('@/app/explorer/utils/history');
                    activity = enrichActivityWithBlocks(activity, blockMap, publicKey);
                  }
                }
              } catch (e) {
                console.log('[EXPLORER_DATA] Block enrichment skipped (provider fallback):', e);
              }
            }
          }
        } else {
              // Public account path: use wallet extension's enhanced history method
              console.log('[EXPLORER_DATA] Fetching public account history via wallet extension...');
              globalThis.console.warn('[EXPLORER_DATA] Using wallet extension history method for public account history');
              
              if (typeof keeta.request === 'function') {
                try {
                  globalThis.console.warn('[EXPLORER_DATA] About to call keeta_getHistoryForAccount RPC method...');
                  globalThis.console.warn('[EXPLORER_DATA] Keeta object methods:', Object.keys(keeta));
                  globalThis.console.warn('[EXPLORER_DATA] Keeta request function type:', typeof keeta.request);
                  
                  // Use the enhanced keeta_getHistoryForAccount RPC method which already extracts from/to/token
                  const data = await keeta.request({ method: 'keeta_getHistoryForAccount', params: [publicKey, { depth: 25 }] });
                  globalThis.console.warn('[EXPLORER_DATA] Enhanced RPC data received:', data);
                  globalThis.console.warn('[EXPLORER_DATA] Enhanced RPC data type:', typeof data);
                  globalThis.console.warn('[EXPLORER_DATA] Enhanced RPC data keys:', Object.keys(data || {}));
                  
                  // The enhanced RPC method already returns the detailed structure with from/to/token
                  if (data && typeof data === 'object' && 'records' in data && Array.isArray(data.records)) {
                    globalThis.console.warn('[EXPLORER_DATA] Processing enhanced records:', data.records.length);
                    activity = normalizeHistoryResponse(data, publicKey);
                    globalThis.console.warn('[EXPLORER_DATA] Enhanced activity result:', activity?.length);
                    globalThis.console.warn('[EXPLORER_DATA] Sample enhanced record:', activity[0]);
                  } else {
                    globalThis.console.warn('[EXPLORER_DATA] No records found in enhanced RPC response');
                    activity = [];
                  }
                } catch (rpcError) {
                  globalThis.console.warn('[EXPLORER_DATA] Enhanced RPC method failed:', rpcError);
                  globalThis.console.warn('[EXPLORER_DATA] RPC Error details:', {
                    message: rpcError instanceof Error ? rpcError.message : String(rpcError),
                    code: (rpcError as any)?.code,
                    stack: rpcError instanceof Error ? rpcError.stack : undefined,
                    name: rpcError instanceof Error ? rpcError.name : undefined
                  });
                  activity = [];
                }
              } else {
                globalThis.console.warn('[EXPLORER_DATA] No RPC request method available');
                activity = [];
              }
        }

        // No backend explorer fallback; rely on SDK/RPC only
      } catch (error) {
        console.log('[EXPLORER_DATA] Error fetching history:', error);
        // Continue without activity data
      }

      // Enrich token display (ticker/decimals) and format amounts
      async function enrichActivityTokens(list: any[]): Promise<any[]> {
        try {
          const items = Array.isArray(list) ? list : [];
          const tokenSet = new Set<string>();
          for (const it of items) {
            if (typeof it?.token === 'string' && it.token.trim().length > 0) tokenSet.add(it.token);
          }
          if (tokenSet.size === 0) return items;
          const tokenAddresses = Array.from(tokenSet);
          const metadataByToken: Record<string, { metadata?: string | null; decimals?: number | null; ticker?: string | null; name?: string | null }> = {};

          function deepFindString(obj: any, keys: string[]): string | null {
            if (!obj || typeof obj !== 'object') return null;
            const stack: any[] = [obj];
            const seen = new Set<any>();
            let depth = 0;
            while (stack.length && depth < 5) {
              const current = stack.shift();
              if (!current || typeof current !== 'object' || seen.has(current)) continue;
              seen.add(current);
              for (const k of keys) {
                if (typeof current?.[k] === 'string' && current[k].trim().length > 0) return current[k];
              }
              for (const v of Object.values(current)) {
                if (v && typeof v === 'object') stack.push(v);
              }
              depth++;
            }
            return null;
          }

          function deepFindNumber(obj: any, keys: string[]): number | null {
            if (!obj || typeof obj !== 'object') return null;
            const stack: any[] = [obj];
            const seen = new Set<any>();
            let depth = 0;
            while (stack.length && depth < 5) {
              const current = stack.shift();
              if (!current || typeof current !== 'object' || seen.has(current)) continue;
              seen.add(current);
              for (const k of keys) {
                const val = current?.[k];
                if (typeof val === 'number' && Number.isFinite(val)) return val;
              }
              for (const v of Object.values(current)) {
                if (v && typeof v === 'object') stack.push(v);
              }
              depth++;
            }
            return null;
          }

          for (const addr of tokenAddresses) {
            try {
              // Prefer inline tokenMetadata in activity records if present for this addr
              const inlineMeta = items.find(it => it?.token === addr && it?.tokenMetadata);
              if (inlineMeta && inlineMeta.tokenMetadata && typeof inlineMeta.tokenMetadata === 'object') {
                const tm = inlineMeta.tokenMetadata as any;
                metadataByToken[addr] = {
                  metadata: null,
                  decimals: typeof tm.decimals === 'number' ? tm.decimals : null,
                  ticker: typeof tm.ticker === 'string' ? tm.ticker : null,
                  name: typeof tm.name === 'string' ? tm.name : null,
                };
              } else {
                const info = await keeta.getAccountInfo?.(addr);
                if (info && typeof info === 'object') {
                  const metadata = deepFindString(info, ['metadata']);
                  const ticker = deepFindString(info, ['ticker', 'symbol', 'currencyCode']);
                  const name = deepFindString(info, ['name', 'displayName']);
                  const decimals = deepFindNumber(info, ['decimals', 'decimalPlaces']);
                  metadataByToken[addr] = { metadata, decimals, ticker, name };
                }
              }
            } catch (e) {
              console.log('[EXPLORER_DATA] getAccountInfo() for token failed:', addr, e);
            }
          }

          // Format amounts and label tokens
          const enriched = await Promise.all(items.map(async (it) => {
            if (!it) return it;
            const tokenAddress = typeof it.token === 'string' && it.token.trim().length > 0 ? it.token : null;
            if (!tokenAddress) return it;

            const meta = metadataByToken[tokenAddress];
            if (!meta) return it;

            try {
              const amountSource = typeof it.rawAmount === 'string' && it.rawAmount.trim().length > 0
                ? it.rawAmount
                : typeof it.amount === 'string' && it.amount.trim().length > 0
                  ? it.amount
                  : '0';

              const processed = await processTokenForDisplay(
                tokenAddress,
                amountSource,
                meta.metadata ?? null,
                baseTokenAddress ?? undefined,
                undefined,
              );

              const formattedWithTicker = processed.formattedAmount
                ? `${processed.formattedAmount}${processed.ticker ? ` ${processed.ticker}` : ''}`.trim()
                : amountSource;

              const mergedTokenMetadata = {
                name: processed.name ?? it.tokenMetadata?.name ?? meta.name ?? null,
                ticker: processed.ticker ?? it.tokenMetadata?.ticker ?? meta.ticker ?? null,
                decimals: typeof processed.decimals === 'number' && Number.isFinite(processed.decimals)
                  ? processed.decimals
                  : it.tokenMetadata?.decimals ?? meta.decimals ?? null,
              } as { name?: string | null; ticker?: string | null; decimals?: number | null };

              return {
                ...it,
                formattedAmount: formattedWithTicker,
                tokenTicker: processed.ticker ?? it.tokenTicker ?? meta.ticker ?? null,
                tokenDecimals: typeof processed.decimals === 'number' && Number.isFinite(processed.decimals)
                  ? processed.decimals
                  : it.tokenDecimals ?? meta.decimals ?? null,
                tokenMetadata: mergedTokenMetadata,
              };
            } catch {
              return it;
            }
          }));
          return enriched;
        } catch (e) {
          console.log('[EXPLORER_DATA] enrichActivityTokens error:', e);
          return list;
        }
      }

      const enrichedActivity = await enrichActivityTokens(activity);
      globalThis.console.warn('[EXPLORER_DATA] Enriched activity:', enrichedActivity);
      globalThis.console.warn('[EXPLORER_DATA] Enriched activity length:', enrichedActivity?.length);

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
        activity: enrichedActivity,
      };

      console.log('[EXPLORER_DATA] Final result:', result);
      globalThis.console.warn('[EXPLORER_DATA] Final result activity length:', result.activity?.length);
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

