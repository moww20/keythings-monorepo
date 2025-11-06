"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { KeetaProvider } from "@/types/keeta";
import {
  explorerNetworkStatsQueryKey,
  historyQueryKey,
  walletQueryKey,
  walletTokensQueryKey,
} from "@/lib/react-query/keys";

function getWalletProvider(): KeetaProvider | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.keeta ?? null;
}

export default function WalletEventsManager(): null {
  const queryClient = useQueryClient();
  const lastAccountRef = useRef<string | null>(null);
  const lastChainRef = useRef<string | null>(null);

  useEffect(() => {
    const provider = getWalletProvider();
    if (!provider?.on) {
      return undefined;
    }

    // Initialize last known values
    try {
      const curAny = (window as any).keeta as any;
      if (curAny) {
        lastAccountRef.current = typeof curAny.selectedAddress === 'string' ? curAny.selectedAddress : null;
        lastChainRef.current = typeof curAny.chainId === 'string' ? curAny.chainId : null;
      }
    } catch {}

    const invalidateWalletAndTokens = () => {
      void queryClient.invalidateQueries({ queryKey: walletQueryKey });
      void queryClient.invalidateQueries({ queryKey: walletTokensQueryKey });
    };

    const invalidateHistoryForCurrent = () => {
      const current = (window as any).keeta?.selectedAddress ?? null;
      void queryClient.invalidateQueries({ queryKey: historyQueryKey(current) });
    };

    const handleAccountsChanged = (accounts?: unknown) => {
      if (typeof window !== 'undefined') {
        try {
          const arr = Array.isArray(accounts) ? accounts : undefined;
          const first = arr && typeof arr[0] === 'string' ? arr[0] : undefined;
          if (first) {
            window.localStorage.setItem('keeta:lastAccount', first);
          }
          // Only invalidate history if account actually changed
          const current = first ?? ((window as any).keeta?.selectedAddress ?? null);
          if (current !== lastAccountRef.current) {
            lastAccountRef.current = current;
            invalidateHistoryForCurrent();
          }
        } catch {}
      }
      invalidateWalletAndTokens();
      void queryClient.invalidateQueries({ queryKey: explorerNetworkStatsQueryKey });
    };
    const handleChainChanged = (chainId?: unknown) => {
      const next = typeof chainId === 'string' && chainId.length > 0 ? chainId : ((window as any).keeta?.chainId ?? null);
      if (next !== lastChainRef.current) {
        lastChainRef.current = next;
        invalidateHistoryForCurrent();
      }
      invalidateWalletAndTokens();
      void queryClient.invalidateQueries({ queryKey: explorerNetworkStatsQueryKey });
    };
    const handleDisconnect = () => {
      invalidateWalletAndTokens();
      void queryClient.invalidateQueries({ queryKey: explorerNetworkStatsQueryKey });
      /* keep history cache */
    };
    const handleConnect = () => {
      const curAny = (window as any).keeta as any;
      const acct = typeof curAny?.selectedAddress === 'string' ? curAny.selectedAddress : null;
      const chain = typeof curAny?.chainId === 'string' ? curAny.chainId : null;
      let changed = false;
      if (acct !== lastAccountRef.current) { lastAccountRef.current = acct; changed = true; }
      if (chain !== lastChainRef.current) { lastChainRef.current = chain; changed = true; }
      if (changed) invalidateHistoryForCurrent();
      invalidateWalletAndTokens();
      void queryClient.invalidateQueries({ queryKey: explorerNetworkStatsQueryKey });
    };
    const handleLocked = () => {

      // Do not invalidate history on lock state changes to preserve cache
      invalidateWalletAndTokens();
      void queryClient.invalidateQueries({ queryKey: explorerNetworkStatsQueryKey });
    };
    const handleUnlocked = () => {

      // Do not invalidate history on lock state changes to preserve cache
      invalidateWalletAndTokens();
      void queryClient.invalidateQueries({ queryKey: explorerNetworkStatsQueryKey });
    };
    const handleLockChanged = (_locked: unknown) => invalidateWalletAndTokens();

    // Listen for common wallet events
    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged as any);
    provider.on("disconnect", handleDisconnect);
    provider.on("connect", handleConnect);

    // Listen for lock state events (canonical + variants for compatibility)
    provider.on("lockChanged", handleLockChanged);
    provider.on("locked", handleLocked);
    provider.on("unlocked", handleUnlocked);
    provider.on("lock", handleLocked);
    provider.on("unlock", handleUnlocked);
    provider.on("walletLocked", handleLocked);
    provider.on("walletUnlocked", handleUnlocked);

    const remove = provider.removeListener?.bind(provider) ?? provider.off?.bind(provider);

    return () => {
      if (!remove) {
        return;
      }
      remove("accountsChanged", handleAccountsChanged);
      remove("chainChanged", handleChainChanged as any);
      remove("disconnect", handleDisconnect);
      remove("connect", handleConnect);
      remove("locked", handleLocked);
      remove("unlocked", handleUnlocked);
      remove("lock", handleLocked);
      remove("unlock", handleUnlocked);
      remove("walletLocked", handleLocked);
      remove("walletUnlocked", handleUnlocked);
      remove("lockChanged", handleLockChanged);
    };
  }, [queryClient]);

  return null;
}
