'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { processTokenForDisplay } from '../lib/token-utils';

const DEFAULT_WALLET_STATE = Object.freeze({
  connected: false,
  accounts: [],
  balance: null,
  network: null,
  isLocked: false,
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
    return DEFAULT_WALLET_STATE;
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
    console.error('useWalletData: Failed to fetch accounts', error);
    return {
      connected: false,
      accounts: [],
      balance: null,
      network: null,
      isLocked,
    };
  }

  if (!accounts.length) {
    return {
      connected: false,
      accounts: [],
      balance: null,
      network: null,
      isLocked: false,
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
      console.error('useWalletData: Failed to resolve balance/network', error);
    }
  }

  return {
    connected: true,
    accounts,
    balance,
    network,
    isLocked,
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
    console.error('useWalletData: Failed to fetch token balances', error);
    return [];
  }

  if (!Array.isArray(balances) || balances.length === 0) {
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
      console.warn('useWalletData: Unable to parse balance for token', entry?.token, error);
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
        console.error('useWalletData: Failed to process token metadata', entry?.token, error);
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

  const tokensQuery = useQuery({
    queryKey: ['wallet', 'tokens', { account: primaryAccount, networkId }],
    queryFn: fetchTokenBalances,
    enabled: Boolean(walletQuery.data?.connected && !walletQuery.data?.isLocked && primaryAccount),
    placeholderData: () => [],
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
