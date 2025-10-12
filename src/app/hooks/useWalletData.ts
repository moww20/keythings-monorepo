import { useCallback, useEffect, useRef, useState } from 'react';

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

  const fetchWalletState = useCallback(async () => {
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

      console.debug('Fetching wallet state...');

      // Get basic wallet info - these operations work without capability tokens
      const [accounts, isLockedResult] = await Promise.all([
        provider.getAccounts(),
        provider.isLocked?.() ?? Promise.resolve(true),
      ]);

      console.debug('Wallet state:', { accounts, isLocked: isLockedResult });

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

      // Wallet is unlocked, request read capabilities first
      console.debug('Wallet unlocked, requesting read capabilities...');
      let capabilityTokens: any = null;
      try {
        if (typeof provider.requestCapabilities === 'function') {
          capabilityTokens = await provider.requestCapabilities(['read']);
          console.debug('Read capability tokens obtained:', capabilityTokens);
        }
      } catch (capError) {
        console.debug('Failed to request capabilities (will retry on individual calls):', capError);
      }

      // Extract the read token if available
      const readToken = Array.isArray(capabilityTokens) && capabilityTokens.length > 0 
        ? capabilityTokens[0]?.token 
        : null;

      // Fetch balance and network using RPC with capability token
      // The wallet extension expects capability tokens wrapped in an object: { capabilityToken: token }
      let balance = '0';
      let network = null;

      try {
        if (typeof provider.request === 'function') {
          // Use RPC method with capability token wrapped in object
          const balanceResult = await provider.request({
            method: 'keeta_getBalance',
            params: readToken ? [accounts[0], { capabilityToken: readToken }] : [accounts[0]]
          });
          balance = typeof balanceResult === 'string' ? balanceResult : String(balanceResult ?? '0');
          console.debug('Balance fetched:', balance);
        }
      } catch (balanceError) {
        console.debug('Failed to fetch balance:', balanceError);
      }

      try {
        if (typeof provider.request === 'function') {
          // Use RPC method with capability token wrapped in object
          const networkResult = await provider.request({
            method: 'keeta_getNetwork',
            params: readToken ? [{ capabilityToken: readToken }] : []
          });
          network = networkResult;
          console.debug('Network fetched:', network);
        }
      } catch (networkError) {
        console.debug('Failed to fetch network:', networkError);
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
      console.error('Failed to resolve balance/network', error);
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
      } catch (fallbackError) {
        console.error('Fallback wallet state fetch failed:', fallbackError);
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

  const connectWallet = useCallback(async () => {
    const provider = getWalletProvider();
    if (!provider) {
      throw new Error('Keeta wallet not found');
    }

    try {
      setErrorState(null);
      setLoadingState(true);

      console.debug('Requesting wallet accounts...');
      const accounts = await provider.requestAccounts();

      if (!Array.isArray(accounts) || accounts.length === 0) {
        throw new Error('No accounts returned from wallet');
      }

      console.debug('Wallet connected with accounts:', accounts);

      // Fetch full wallet state after connection
      await fetchWalletState();

    } catch (error) {
      console.error('Wallet connection failed:', error);
      setErrorState(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    } finally {
      setLoadingState(false);
    }
  }, [fetchWalletState, setErrorState, setLoadingState]);

  const refreshWallet = useCallback(async () => {
    await fetchWalletState();
  }, [fetchWalletState]);

  // Set up wallet event listeners
  useEffect(() => {
    const provider = getWalletProvider();
    if (!provider) return;

    const handleAccountsChanged = (accounts: unknown) => {
      console.debug('Accounts changed:', accounts);
      fetchWalletState();
    };

    const handleLockChanged = (isLocked: unknown) => {
      console.debug('Lock status changed:', isLocked);
      updateWalletData({ isLocked: Boolean(isLocked) });
      if (!isLocked) {
        // If wallet was unlocked, refresh the full state
        fetchWalletState();
      }
    };

    const handleDisconnect = () => {
      console.debug('Wallet disconnected');
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

    // Initial fetch
    fetchWalletState();

    // Cleanup
    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('lockChanged', handleLockChanged);
      provider.removeListener?.('disconnect', handleDisconnect);
    };
  }, [fetchWalletState, updateWalletData]);

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
export function useTokenBalances(shouldFetch: boolean = false) {
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
      const provider = getWalletProvider();
    if (!provider) {
      if (isMountedRef.current) {
        setBalances([]);
        }
        return;
      }

      try {
      if (isMountedRef.current) {
        setIsLoading(true);
        setError(null);
      }
      
      console.debug('Fetching token balances...');
      
      // Request read capability first
      let readToken: string | null = null;
      try {
        if (typeof provider.requestCapabilities === 'function') {
          const tokens = await provider.requestCapabilities(['read']);
          if (Array.isArray(tokens) && tokens.length > 0 && tokens[0] && typeof tokens[0] === 'object' && 'token' in tokens[0]) {
            readToken = tokens[0].token as string;
            console.debug('Got read capability token for getAllBalances');
          }
        }
      } catch (capError) {
        console.debug('Failed to get capability token for getAllBalances:', capError);
      }

      // Use RPC method with capability token
      // The wallet extension expects capability tokens wrapped in an object: { capabilityToken: token }
      let result;
      if (typeof provider.request === 'function' && readToken) {
        console.debug('Fetching balances via RPC with capability token...');
        result = await provider.request({
          method: 'keeta_getAllBalances',
          params: [{ capabilityToken: readToken }]
        });
      } else {
        console.debug('Fetching balances via direct method...');
        // Fallback to direct method call (may fail without token)
        result = await provider.getAllBalances();
      }
      
      if (!isMountedRef.current) return;
      
      if (Array.isArray(result)) {
        console.debug('Token balances received:', result);
        setBalances(result);
      } else {
        console.debug('No balances received or invalid format');
        setBalances([]);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Failed to fetch token balances:', error);
      setError(`Failed to fetch balances: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setBalances([]);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Automatically fetch when shouldFetch changes to true
  useEffect(() => {
    if (shouldFetch) {
      fetchTokenBalances();
    }
  }, [shouldFetch, fetchTokenBalances]);

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
      
      console.debug('Fetching token metadata for:', tokenAddress);
      // Note: getTokenMetadata is not available in the current KeetaProvider interface
      // This would need to be implemented via the request method or added to the interface
      setMetadata(null);
    } catch (error) {
      console.error('Failed to fetch token metadata:', error);
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
      
      console.debug('Fetching KTA price...');
      const result = await provider.getKtaPrice?.();
      
      if (result && typeof result === 'object' && 'price' in result) {
        setPriceData(result as { price: number });
      } else {
        setPriceData(null);
      }
    } catch (error) {
      console.error('Failed to fetch KTA price:', error);
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