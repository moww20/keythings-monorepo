"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { KeetaProvider } from "@/types/keeta";

const WALLET_QUERY_KEY = ["wallet"] as const;
const TOKEN_QUERY_KEY = ["wallet", "tokens"] as const;

function getWalletProvider(): KeetaProvider | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.keeta ?? null;
}

export default function WalletEventsManager(): null {
  const queryClient = useQueryClient();

  useEffect(() => {
    const provider = getWalletProvider();
    if (!provider?.on) {
      return undefined;
    }

    const invalidateWalletQueries = () => {
      void queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: TOKEN_QUERY_KEY });
    };

    const handleAccountsChanged = () => invalidateWalletQueries();
    const handleChainChanged = () => invalidateWalletQueries();
    const handleDisconnect = () => invalidateWalletQueries();
    const handleConnect = () => invalidateWalletQueries();
    const handleLocked = () => {
      console.debug("Wallet locked event received");
      invalidateWalletQueries();
    };
    const handleUnlocked = () => {
      console.debug("Wallet unlocked event received");
      invalidateWalletQueries();
    };

    // Listen for common wallet events
    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    provider.on("disconnect", handleDisconnect);
    provider.on("connect", handleConnect);

    // Listen for lock state events (try multiple possible event names)
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
      remove("chainChanged", handleChainChanged);
      remove("disconnect", handleDisconnect);
      remove("connect", handleConnect);
      remove("locked", handleLocked);
      remove("unlocked", handleUnlocked);
      remove("lock", handleLocked);
      remove("unlock", handleUnlocked);
      remove("walletLocked", handleLocked);
      remove("walletUnlocked", handleUnlocked);
    };
  }, [queryClient]);

  return null;
}
