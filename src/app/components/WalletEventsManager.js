'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const WALLET_QUERY_KEY = ['wallet'];
const TOKEN_QUERY_KEY = ['wallet', 'tokens'];

function getWalletProvider() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.keeta ?? null;
}

export default function WalletEventsManager() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const provider = getWalletProvider();
    if (!provider?.on) {
      return undefined;
    }

    const invalidateWalletQueries = () => {
      queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: TOKEN_QUERY_KEY });
    };

    const handleAccountsChanged = () => invalidateWalletQueries();
    const handleChainChanged = () => invalidateWalletQueries();
    const handleDisconnect = () => invalidateWalletQueries();
    const handleConnect = () => invalidateWalletQueries();

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);
    provider.on('disconnect', handleDisconnect);
    provider.on('connect', handleConnect);

    const remove = provider.removeListener?.bind(provider) || provider.off?.bind(provider);

    return () => {
      if (!remove) {
        return;
      }
      remove('accountsChanged', handleAccountsChanged);
      remove('chainChanged', handleChainChanged);
      remove('disconnect', handleDisconnect);
      remove('connect', handleConnect);
    };
  }, [queryClient]);

  return null;
}
