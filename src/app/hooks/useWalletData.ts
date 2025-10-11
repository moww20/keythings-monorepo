"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryFunctionContext, QueryObserverResult } from "@tanstack/react-query";

import type { KeetaBalanceEntry, KeetaNetworkInfo, KeetaProvider, KeetaUserClient } from "@/types/keeta";
import { processTokenForDisplay, type ProcessedToken } from "../lib/token-utils";
import { isRateLimitedError } from "../lib/wallet-throttle";

interface WalletState {
  connected: boolean;
  accounts: string[];
  balance: string | number | bigint | null;
  network: KeetaNetworkInfo | null | undefined;
  isLocked: boolean;
  isInitializing: boolean;
}

interface TokenQueryParams {
  account: string | null;
  networkId: string | number | null;
}

type TokenQueryKey = ['wallet', 'tokens', TokenQueryParams];

export interface WalletData {
  wallet: WalletState;
  tokens: ProcessedToken[];
  formattedBalance: string;
  isWalletLoading: boolean;
  isWalletFetching: boolean;
  walletError: unknown;
  isTokensLoading: boolean;
  isTokensFetching: boolean;
  tokensError: unknown;
  refetchWallet: () => Promise<QueryObserverResult<WalletState, unknown>>;
  refetchTokens: () => Promise<QueryObserverResult<ProcessedToken[], unknown>>;
  connectWallet: () => Promise<string[]>;
  refreshWallet: () => void;
  userClient: KeetaUserClient | null;
}

const DEFAULT_WALLET_STATE: WalletState = {
  connected: false,
  accounts: [],
  balance: null,
  network: null,
  isLocked: false,
  isInitializing: true, // Track if we're still checking connection
};

const WALLET_QUERY_KEY = ['wallet', 'state'] as const;

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return Boolean(value) && typeof (value as PromiseLike<T>).then === 'function';
}

function getWalletProvider(): KeetaProvider | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.keeta ?? null;
}

const errorMessageIncludes = (error: unknown, text: string): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const message = (error as { message?: unknown }).message;
  if (typeof message !== 'string') {
    return false;
  }

  return message.includes(text);
};

const hasErrorCode = (error: unknown, code: number): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = (error as { code?: unknown }).code;
  return typeof candidate === 'number' && candidate === code;
};

async function fetchWalletState(): Promise<WalletState> {
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
    } else {
      console.debug('Wallet provider does not have isLocked() method');
    }
  } catch (error) {
    console.debug('Failed to read wallet lock status:', error);
    // If we can't check lock status and get session expired, assume locked
    if (errorMessageIncludes(error, 'Session expired') || errorMessageIncludes(error, 're-login')) {
      console.debug('Cannot check lock status due to session expired, assuming wallet is locked');
      isLocked = true;
    }
  }

  let accounts: string[] = [];
  try {
    accounts = (await provider.getAccounts()) ?? [];
  } catch (error) {
    // Handle session expiration - treat as locked wallet
    if (errorMessageIncludes(error, 'Session expired') || errorMessageIncludes(error, 're-login')) {
      console.debug('Account query failed due to session expired, treating as locked wallet');
      console.debug('Note: isLocked() API returned:', isLocked, 'but session is expired - wallet is in inconsistent state');
      return {
        connected: true, // Connected but locked
        accounts: [],
        balance: null,
        network: null,
        isLocked: true, // Force locked state despite API saying false
        isInitializing: false,
      };
    }

    // Silently handle rate-limiting errors - wallet is throttled but functional
    if (isRateLimitedError(error)) {
      console.debug('Account query throttled, will retry automatically');
      return {
        connected: false,
        accounts: [],
        balance: null,
        network: null,
        isLocked,
        isInitializing: false,
      };
    }
    console.debug('Failed to fetch accounts:', error);
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
    // If no accounts but wallet provider exists, treat as connected but potentially locked
    // This handles cases where wallet is installed but not authorized or locked
    return {
      connected: true, // Always connected if wallet provider exists
      accounts: [],
      balance: null,
      network: null,
      isLocked: true, // Assume locked if we can't determine status
      isInitializing: false,
    };
  }

  let balance: string | number | bigint | null = null;
  let network: KeetaNetworkInfo | null | undefined = null;

  if (!isLocked) {
    try {
      [balance, network] = await Promise.all([
        provider.getBalance(accounts[0]),
        provider.getNetwork(),
      ]);
    } catch (error) {
      // Handle session expiration - treat as locked wallet
      if (errorMessageIncludes(error, 'Session expired') || errorMessageIncludes(error, 're-login')) {
        console.debug('useWalletData: Balance/network fetch failed due to session expired, treating as locked wallet');
        console.debug('Note: isLocked() API returned:', isLocked, 'but session is expired - wallet is in inconsistent state');
        // Force locked state when session is expired, regardless of isLocked() API result
        return {
          connected: true, // Connected but locked
          accounts: [],
          balance: null,
          network: null,
          isLocked: true, // Force locked state
          isInitializing: false,
        };
      }

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

async function fetchTokenBalances({ queryKey }: QueryFunctionContext<TokenQueryKey>): Promise<ProcessedToken[]> {
  const [, , params] = queryKey;
  const provider = getWalletProvider();

  if (!provider || !params?.account) {
    return [];
  }

  let balances: KeetaBalanceEntry[];
  try {
    balances = await provider.getAllBalances();
  } catch (error) {
    // Handle session expiration - throw so retry logic can catch it
    if (errorMessageIncludes(error, 'Session expired') || errorMessageIncludes(error, 're-login')) {
      throw error; // Let the retry logic handle this
    }

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

  let baseTokenAddress: string | null = null;
  try {
    const baseTokenInfo = await provider.getBaseToken();
    baseTokenAddress = typeof baseTokenInfo?.address === 'string' ? baseTokenInfo.address : null;
  } catch (error) {
    console.warn('useWalletData: Failed to fetch base token info', error);
  }

  const nonZeroBalances = balances.filter((entry) => {
    try {
      return Boolean(entry.balance) && BigInt(entry.balance) > BigInt(0);
    } catch (error) {
      console.warn('Unable to parse balance for token', entry?.token, error);
      return false;
    }
  });

  if (nonZeroBalances.length === 0) {
    return [];
  }

  const processedTokens = await Promise.all(
    nonZeroBalances.map(async (entry) => {
      try {
        return await processTokenForDisplay(
          entry.token,
          entry.balance,
          entry.metadata ?? null,
          baseTokenAddress,
        );
      } catch (error) {
        console.error('Failed to process token:', entry?.token, error);
        return null;
      }
    }),
  );

  const validTokens = processedTokens.filter((token): token is ProcessedToken => Boolean(token));

  validTokens.sort((a, b) => {
    if (a.isBaseToken) return -1;
    if (b.isBaseToken) return 1;
    return a.name.localeCompare(b.name);
  });

  return validTokens;
}

export function useWalletData(): WalletData {
  const queryClient = useQueryClient();

  // Track session expiration to force locked state
  const [sessionExpired, setSessionExpired] = useState(false);
  const [userClient, setUserClient] = useState<KeetaUserClient | null>(null);

  const walletQuery = useQuery<WalletState>({
    queryKey: WALLET_QUERY_KEY,
    queryFn: fetchWalletState,
    placeholderData: DEFAULT_WALLET_STATE,
    staleTime: 0, // Always check for fresh data
    refetchOnMount: true, // Refetch when component mounts
  });

  const primaryAccount = walletQuery.data?.accounts?.[0] ?? null;
  const networkId = walletQuery.data?.network?.chainId ?? null;

  const isQueryEnabled = Boolean(walletQuery.data?.connected && !walletQuery.data?.isLocked && primaryAccount);

  const tokensQuery = useQuery<ProcessedToken[], Error, ProcessedToken[], TokenQueryKey>({
    queryKey: ['wallet', 'tokens', { account: primaryAccount, networkId }],
    queryFn: fetchTokenBalances,
    enabled: isQueryEnabled,
    placeholderData: () => [],
    retry: (failureCount, error) => {
      // Don't retry on user rejection
      if (hasErrorCode(error, 4001)) return false;

      // Don't retry on session expiration - this indicates wallet is locked
      if (errorMessageIncludes(error, 'Session expired') || errorMessageIncludes(error, 're-login')) {
        setSessionExpired(true);
        return false;
      }

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

    try {
      const accounts = await provider.requestAccounts();

      // Reset session expired flag on successful connection
      setSessionExpired(false);

      await queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ['wallet', 'tokens'] });

      return accounts;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }, [queryClient]);

  const refreshWallet = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['wallet', 'tokens'] });
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;

    const resolveUserClient = async () => {
      const provider = getWalletProvider();
      const factory = provider?.createUserClient ?? provider?.getUserClient;

      if (!factory) {
        if (!cancelled) {
          setUserClient(null);
        }
        return;
      }

      try {
        const maybeClient = factory();
        const resolved = isPromiseLike<KeetaUserClient>(maybeClient) ? await maybeClient : maybeClient;
        if (!cancelled) {
          setUserClient(resolved ?? null);
        }
      } catch (error) {
        console.debug('useWalletData: Failed to initialize user client', error);
        if (!cancelled) {
          setUserClient(null);
        }
      }
    };

    void resolveUserClient();

    return () => {
      cancelled = true;
    };
  }, [walletQuery.data?.connected, walletQuery.data?.accounts, sessionExpired]);

  // Reset session expired flag when wallet is successfully unlocked
  useEffect(() => {
    const baseWallet = walletQuery.data ?? DEFAULT_WALLET_STATE;
    if (baseWallet.connected && !baseWallet.isLocked && baseWallet.accounts?.length > 0 && sessionExpired) {
      console.debug('Wallet successfully unlocked, resetting session expired flag');
      setSessionExpired(false);
    }
  }, [walletQuery.data, sessionExpired]);

  const wallet = useMemo<WalletState>(() => {
    const baseWallet = walletQuery.data ?? DEFAULT_WALLET_STATE;

    // If session is expired, force locked state regardless of API response
    if (sessionExpired) {
      return {
        ...baseWallet,
        isLocked: true,
        connected: true, // Still connected but locked
      };
    }

    return baseWallet;
  }, [walletQuery.data, sessionExpired]);

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
    userClient,
  };
}
