'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { processTokenForDisplay } from '../lib/token-utils';
import { isRateLimitedError } from '../lib/wallet-throttle';

const DEFAULT_WALLET_STATE = Object.freeze({
  connected: false,
  accounts: [],
  balance: null,
  network: null,
  isLocked: false,
  isInitializing: true, // Track if we're still checking connection
});

const WALLET_QUERY_KEY = ['wallet', 'state'];

function getWalletProvider() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.keeta ?? null;
}

async function fetchWalletState() {
  const provider = getWalletProvider();

  if (!provider) {
    return {
      ...DEFAULT_WALLET_STATE,
      isInitializing: false,
    };
  }

  let isLocked = false;
  try {
    if (typeof provider.isLocked === 'function') {
      isLocked = await provider.isLocked();
    }
  } catch (error) {
    console.warn('useWalletData: Failed to read lock status', error);
  }

  let accounts = [];
  try {
    accounts = (await provider.getAccounts()) ?? [];
  } catch (error) {
    // Silently handle rate-limiting errors - wallet is throttled but functional
    if (isRateLimitedError(error)) {
      console.debug('useWalletData: Account query throttled, will retry automatically');
      return {
        connected: false,
        accounts: [],
        balance: null,
        network: null,
        isLocked,
      };
    }
    console.error('useWalletData: Failed to fetch accounts', error);
    return {
      connected: false,
      accounts: [],
      balance: null,
      network: null,
      isLocked,
      isInitializing: false,
    };
  }

  // If no accounts, try checking if we should auto-connect
  // This happens when the user has previously granted permission
  if (!accounts.length) {
    try {
      // Check if the provider has a method to check previous permissions
      if (typeof provider.isConnected === 'function') {
        const wasConnected = await provider.isConnected();
        if (wasConnected) {
          console.log('Wallet was previously connected, attempting to reconnect...');
          // Try to reconnect silently
          accounts = (await provider.getAccounts()) ?? [];
        }
      } else if (typeof provider.isConnected === 'boolean' && provider.isConnected) {
        console.log('Wallet shows connected state, attempting to fetch accounts...');
        accounts = (await provider.getAccounts()) ?? [];
      }
    } catch (error) {
      console.debug('Auto-connect check failed:', error);
    }
  }

  if (!accounts.length) {
    return {
      connected: false,
      accounts: [],
      balance: null,
      network: null,
      isLocked: false,
      isInitializing: false,
    };
  }

  let balance = null;
  let network = null;

  if (!isLocked) {
    try {
      [balance, network] = await Promise.all([
        provider.getBalance(accounts[0]),
        provider.getNetwork(),
      ]);
    } catch (error) {
      // Silently handle rate-limiting errors - wallet is throttled but functional
      if (isRateLimitedError(error)) {
        console.debug('useWalletData: Balance query throttled, will retry automatically');
      } else {
        console.error('useWalletData: Failed to resolve balance/network', error);
      }
    }
  }

  return {
    connected: true,
    accounts,
    balance,
    network,
    isLocked,
    isInitializing: false,
  };
}

async function fetchTokenBalances({ queryKey }) {
  const [, , params] = queryKey;
  const provider = getWalletProvider();

  if (!provider || !params?.account) {
    return [];
  }

  let balances;
  try {
    balances = await provider.getAllBalances();
  } catch (error) {
    // Handle rate-limiting errors - throw so React Query can retry
    if (isRateLimitedError(error)) {
      console.debug('Token balance query throttled, retrying...');
      throw error; // Let React Query handle the retry
    }
    console.error('Failed to fetch token balances:', error);
    throw error; // Let React Query handle other errors too
  }

  if (!Array.isArray(balances)) {
    console.warn('getAllBalances() returned non-array:', typeof balances);
    return [];
  }

  if (balances.length === 0) {
    return [];
  }

  let baseTokenAddress = null;
  try {
    const baseTokenInfo = await provider.getBaseToken();
    baseTokenAddress = baseTokenInfo?.address ?? null;
  } catch (error) {
    console.warn('useWalletData: Failed to fetch base token info', error);
  }

  const nonZeroBalances = balances.filter(entry => {
    try {
      return entry.balance && BigInt(entry.balance) > 0n;
    } catch (error) {
      console.warn('Unable to parse balance for token', entry?.token);
      return false;
    }
  });

  if (nonZeroBalances.length === 0) {
    return [];
  }

  const processedTokens = await Promise.all(
    nonZeroBalances.map(async entry => {
      try {
        return await processTokenForDisplay(
          entry.token,
          entry.balance,
          entry.metadata,
          baseTokenAddress
        );
      } catch (error) {
        console.error('Failed to process token:', entry?.token, error);
        return null;
      }
    })
  );

  const validTokens = processedTokens.filter(Boolean);

  validTokens.sort((a, b) => {
    if (a.isBaseToken) return -1;
    if (b.isBaseToken) return 1;
    return a.name.localeCompare(b.name);
  });

  return validTokens;
}

export function useWalletData() {
  const queryClient = useQueryClient();

  const walletQuery = useQuery({
    queryKey: WALLET_QUERY_KEY,
    queryFn: fetchWalletState,
    initialData: DEFAULT_WALLET_STATE,
  });

  const primaryAccount = walletQuery.data?.accounts?.[0] ?? null;
  const networkId = walletQuery.data?.network?.chainId ?? null;

  const isQueryEnabled = Boolean(walletQuery.data?.connected && !walletQuery.data?.isLocked && primaryAccount);

  const tokensQuery = useQuery({
    queryKey: ['wallet', 'tokens', { account: primaryAccount, networkId }],
    queryFn: fetchTokenBalances,
    enabled: isQueryEnabled,
    placeholderData: () => [],
    retry: (failureCount, error) => {
      // Don't retry on user rejection
      if (error?.code === 4001) return false;
      
      // Retry throttled requests up to 3 times
      if (isRateLimitedError(error)) {
        return failureCount < 3;
      }
      
      // Retry other errors once
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => {
      // Use exponential backoff: 2s, 4s, 8s
      return Math.min(1000 * 2 ** attemptIndex, 8000);
    },
  });

  const connectWallet = useCallback(async () => {
    const provider = getWalletProvider();
    if (!provider) {
      throw new Error('Keeta wallet provider not found.');
    }

    const accounts = await provider.requestAccounts();
    await queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
    await queryClient.invalidateQueries({ queryKey: ['wallet', 'tokens'] });

    return accounts;
  }, [queryClient]);

  const refreshWallet = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ['wallet', 'tokens'] });
  }, [queryClient]);

  const wallet = walletQuery.data ?? DEFAULT_WALLET_STATE;
  const tokens = tokensQuery.data ?? [];

  const formattedBalance = useMemo(() => {
    const balance = wallet.balance;
    if (balance === null || typeof balance === 'undefined') {
      return '0.00';
    }
    return (Number(balance) / 10 ** 18).toFixed(2);
  }, [wallet.balance]);

  return {
    wallet,
    tokens,
    formattedBalance,
    isWalletLoading: walletQuery.isLoading,
    isWalletFetching: walletQuery.isFetching,
    walletError: walletQuery.error,
    isTokensLoading: tokensQuery.isLoading,
    isTokensFetching: tokensQuery.isFetching,
    tokensError: tokensQuery.error,
    refetchWallet: walletQuery.refetch,
    refetchTokens: tokensQuery.refetch,
    connectWallet,
    refreshWallet,
  };
}
