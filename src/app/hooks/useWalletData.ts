import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeBalances } from '@/app/lib/balances/normalize';
import { getReadClient, getAccountState, getAggregatedBalancesForOwner } from '@/lib/explorer/sdk-read-client';

// Import the existing KeetaProvider type to avoid conflicts
import type { KeetaProvider, KeetaNetworkInfo, KeetaBalanceEntry, KeetaBaseTokenInfo } from '../../types/keeta';

interface WalletData {
  connected: boolean;
  accounts: string[];
  balance: string;
  network: unknown;
  isLocked: boolean;
  isInitializing: boolean;
}

// Simple error message checker
function errorMessageIncludes(error: unknown, searchText: string): boolean {
  if (error instanceof Error) {
    return error.message.toLowerCase().includes(searchText.toLowerCase());
  }
  if (typeof error === 'string') {
    return error.toLowerCase().includes(searchText.toLowerCase());
  }
  return false;
}

function getWalletProvider(): KeetaProvider | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.keeta ?? null;
}

export function useWalletData() {
  const [walletData, setWalletData] = useState<WalletData>({
    connected: false,
    accounts: [],
    balance: '0',
    network: null,
    isLocked: true,
    isInitializing: true,
  });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const updateWalletData = useCallback((updates: Partial<WalletData>) => {
    if (!isMountedRef.current) return;
    setWalletData(prev => ({ ...prev, ...updates }));
  }, []);

  const setErrorState = useCallback((errorMessage: string | null) => {
    if (!isMountedRef.current) return;
    setError(errorMessage);
  }, []);

  const setLoadingState = useCallback((loading: boolean) => {
    if (!isMountedRef.current) return;
    setIsLoading(loading);
  }, []);

  // Based on Keeta wallet extension source code analysis:
  // Read operations (getBalance, getNetwork, getAllBalances) do NOT require capability tokens
  // Only sign and transact operations require capability tokens
  // The wallet extension handles capability token management internally

  const fetchWalletState = useCallback(async (requestCapabilities = false) => {
    const provider = getWalletProvider();
    if (!provider) {
      updateWalletData({
        connected: false,
        accounts: [],
        balance: '0',
        network: null,
        isLocked: true,
        isInitializing: false,
      });
      return;
    }

    try {
      setErrorState(null);
      setLoadingState(true);

      // Get basic wallet info - these operations work without capability tokens
      const [accounts, isLockedResult] = await Promise.all([
        provider.getAccounts(),
        provider.isLocked?.() ?? Promise.resolve(true),
      ]);

      if (!Array.isArray(accounts) || accounts.length === 0) {
        updateWalletData({
          connected: false,
          accounts: [],
          balance: '0',
          network: null,
          isLocked: true,
          isInitializing: false,
        });
        return;
      }

      // If wallet is locked, don't try to fetch balance/network
      if (isLockedResult) {
        updateWalletData({
          connected: true,
          accounts,
          balance: '0',
          network: null,
          isLocked: true,
          isInitializing: false,
        });
        return;
      }

      // SDK-only reads for balance and network
      let balance = '0';
      let network: unknown = null;
      try {
        const client = await getReadClient();
        // Derive base token address
        let baseTokenAddress = '';
        try {
          const bt = (client as any)?.baseToken;
          const pk = (bt?.publicKeyString && typeof bt.publicKeyString === 'string')
            ? bt.publicKeyString
            : (bt?.publicKeyString && typeof bt.publicKeyString?.toString === 'function')
              ? String(bt.publicKeyString.toString())
              : '';
          if (pk && pk !== '[object Object]') baseTokenAddress = pk;
        } catch {}

        const state: any = await getAccountState(accounts[0]);
        const entries: any[] = Array.isArray(state?.balances)
          ? state.balances
          : Array.isArray(state?.tokens)
            ? state.tokens
            : [];
        if (entries.length && baseTokenAddress) {
          for (const entry of entries) {
            const tokenAddr = ((): string => {
              const v = (entry as any)?.token ?? (entry as any)?.publicKey;
              if (typeof v === 'string') return v;
              try { return String(v?.toString?.() ?? ''); } catch { return ''; }
            })();
            const raw = (entry as any)?.balance ?? (entry as any)?.amount;
            if (tokenAddr === baseTokenAddress && (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'bigint')) {
              balance = String(raw);
              break;
            }
          }
        }
        try {
          network = (client as any)?.networkAlias ?? (client as any)?.network ?? null;
        } catch {}
      } catch {
      }

      updateWalletData({
        connected: true,
        accounts,
        balance,
        network,
        isLocked: false,
        isInitializing: false,
      });

    } catch (error) {
      setErrorState(`Failed to fetch wallet data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Still update with basic info even if balance/network failed
      try {
        const accounts = await provider.getAccounts();
        const isLocked = await provider.isLocked?.() ?? true;
        
        updateWalletData({
          connected: Array.isArray(accounts) && accounts.length > 0,
          accounts: Array.isArray(accounts) ? accounts : [],
          balance: '0',
          network: null,
          isLocked: isLocked,
          isInitializing: false,
        });
      } catch {
        updateWalletData({
          connected: false,
          accounts: [],
          balance: '0',
          network: null,
          isLocked: true,
          isInitializing: false,
        });
      }
    } finally {
      setLoadingState(false);
    }
  }, [updateWalletData, setErrorState, setLoadingState]);

  const connectWallet = useCallback(async (requestCapabilities = false) => {
    if (isLoading) return;
    
    const provider = getWalletProvider();
    if (!provider) {
      throw new Error('Keeta wallet not found');
    }

    try {
      setErrorState(null);
      setLoadingState(true);

      // Request account access with minimal permissions
      let accounts: unknown = null;

      if (typeof provider.request === 'function') {
        accounts = await provider.request({
          method: 'keeta_requestAccounts',
          params: requestCapabilities ? [{ capabilities: ['read', 'transact'] }] : [],
        });
      } else if (typeof provider.getAccounts === 'function') {
        // Fallback for providers that expose getAccounts() directly
        accounts = await provider.getAccounts();
      } else {
        throw new Error('Keeta provider does not support account requests');
      }

      if (!Array.isArray(accounts) || accounts.length === 0) {
        throw new Error('No accounts found. Please ensure your wallet is unlocked and has accounts.');
      }

      // Update with basic account info first
      updateWalletData({
        connected: true,
        accounts: accounts as string[],
        balance: '0',
        network: null,
        isLocked: false,
        isInitializing: false,
      });
      
      // Then fetch the rest of the wallet state with capabilities if requested
      if (requestCapabilities) {
        await fetchWalletState(true);
      }
      
    } catch (error) {
      setErrorState(error instanceof Error ? error.message : 'Failed to connect wallet');
      throw error; // Re-throw to allow calling code to handle the error
    } finally {
      setLoadingState(false);
    }
  }, [fetchWalletState, isLoading, setErrorState, setLoadingState, updateWalletData]);

  const refreshWallet = useCallback(async () => {
    await fetchWalletState(true);
  }, [fetchWalletState]);

  // Rate limiting for refresh operations
  const lastRefreshRef = useRef(0);
  const REFRESH_THROTTLE_MS = 1000; // 1 second

  const throttledRefresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshRef.current > REFRESH_THROTTLE_MS) {
      lastRefreshRef.current = now;
      await refreshWallet();
    }
  }, [refreshWallet]);

  // Set up wallet event listeners
  useEffect(() => {
    const provider = getWalletProvider();
    if (!provider) return;

    const handleAccountsChanged = (accounts: unknown) => {
      void throttledRefresh();
    };

    const handleLockChanged = (isLocked: unknown) => {
      updateWalletData({ isLocked: Boolean(isLocked) });
      if (!isLocked) {
        // If wallet was unlocked, refresh the state (throttled)
        void throttledRefresh();
      }
    };

    const handleDisconnect = () => {
      updateWalletData({
        connected: false,
        accounts: [],
        balance: '0',
        network: null,
        isLocked: true,
        isInitializing: false,
      });
    };

    // Add event listeners
    provider.on?.('accountsChanged', handleAccountsChanged);
    provider.on?.('lockChanged', handleLockChanged);
    provider.on?.('disconnect', handleDisconnect);

    // Initial fetch with read capabilities
    fetchWalletState(true);

    // Cleanup
    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('lockChanged', handleLockChanged);
      provider.removeListener?.('disconnect', handleDisconnect);
    };
  }, [fetchWalletState, updateWalletData, throttledRefresh]);

  return {
    wallet: walletData,
    error,
    isLoading,
    connectWallet,
    refreshWallet: throttledRefresh,
    fetchWalletState,
  };
}

// Hook for fetching token balances - with capability token support
export function useTokenBalances(shouldFetch: boolean = false, ownerPublicKey?: string) {
  const [balances, setBalances] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchTokenBalances = useCallback(async () => {
    if (!ownerPublicKey) {
      if (isMountedRef.current) setBalances([]);
      return;
    }
    try {
      if (isMountedRef.current) {
        setIsLoading(true);
        setError(null);
      }
      const entries = await getAggregatedBalancesForOwner(ownerPublicKey, { includeTokenMetadata: true });
      if (!isMountedRef.current) return;
      // Map to the minimal shape expected downstream
      const mapped = entries.map((e) => ({ token: e.token, balance: e.balance, metadata: e.metadata }));
      // Keep normalize utility to ensure consistent shape
      const normalized = normalizeBalances(mapped as any);
      setBalances(normalized);
    } catch (error) {
      if (!isMountedRef.current) return;
      setError(`Failed to fetch balances: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setBalances([]);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [ownerPublicKey]);

  // Automatically fetch when shouldFetch changes to true
  useEffect(() => {
    if (shouldFetch && ownerPublicKey) {
      fetchTokenBalances();
    }
  }, [shouldFetch, ownerPublicKey, fetchTokenBalances]);

  return {
    balances,
    isLoading,
    error,
    fetchTokenBalances,
  };
}

// Hook for fetching token metadata - simplified without capability tokens
export function useTokenMetadata(tokenAddress: string) {
  const [metadata, setMetadata] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokenMetadata = useCallback(async () => {
    if (!tokenAddress) {
      setMetadata(null);
      return;
    }

    const provider = getWalletProvider();
    if (!provider) {
      setMetadata(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Note: getTokenMetadata is not available in the current KeetaProvider interface
      // This would need to be implemented via the request method or added to the interface
      setMetadata(null);
    } catch (error) {
      setError(`Failed to fetch metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setMetadata(null);
    } finally {
      setIsLoading(false);
    }
  }, [tokenAddress]);

  useEffect(() => {
    fetchTokenMetadata();
  }, [fetchTokenMetadata]);

      return {
    metadata,
    isLoading,
    error,
    refetch: fetchTokenMetadata,
  };
}

// Hook for fetching KTA price - simplified without capability tokens
export function useKtaPrice() {
  const [priceData, setPriceData] = useState<{ price: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKtaPrice = useCallback(async () => {
    const provider = getWalletProvider();
    if (!provider) {
      setPriceData(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const result = await provider.getKtaPrice?.();
      
      if (result && typeof result === 'object' && 'price' in result) {
        setPriceData(result as { price: number });
      } else {
        setPriceData(null);
      }
    } catch (error) {
      setError(`Failed to fetch price: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setPriceData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    priceData,
    isLoading,
    error,
    fetchKtaPrice,
  };
}

// Global window type declaration
declare global {
  interface Window {
    keeta?: KeetaProvider;
  }
}