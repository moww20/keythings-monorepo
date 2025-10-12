"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import { useEffect, useState } from "react";
import { useWalletData, useTokenBalances } from "../hooks/useWalletData";
import type { ProcessedToken } from "../lib/token-utils";
import { processTokenForDisplay } from "../lib/token-utils";
import type { KeetaUserClient, KeetaBalanceEntry } from "../../types/keeta";

interface WalletContextValue {
  // Wallet data from useWalletData
  wallet: {
    connected: boolean;
    accounts: string[];
    balance: string;
    network: unknown;
    isLocked: boolean;
    isInitializing: boolean;
  };
  error: string | null;
  isLoading: boolean;
  connectWallet: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  fetchWalletState: () => Promise<void>;
  
  // Derived state indicators
  isDisconnected: boolean;
  isLocked: boolean;
  isUnlocked: boolean;
  isConnected: boolean;
  publicKey: string | null;
  signMessage: ((message: string) => Promise<string>) | null;
  userClient: KeetaUserClient | null;
  
  // Legacy properties for backward compatibility
  isWalletLoading: boolean;
  isWalletFetching: boolean;
  walletError: string | null;
  
  // Token-related properties
  tokens: ProcessedToken[];
  isTokensLoading: boolean;
  isTokensFetching: boolean;
  tokensError: string | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * WalletProvider - Centralized wallet state management
 * 
 * Provides a single source of truth for wallet state across the entire app.
 * Wraps the useWalletData hook and provides clear state indicators.
 */
interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const walletData = useWalletData();
  
  // Determine if we should fetch token balances
  const shouldFetchTokens = walletData.wallet.connected && !walletData.wallet.isLocked;
  const tokenBalances = useTokenBalances(shouldFetchTokens);
  
  // Process raw token balances into ProcessedToken[] format
  const [processedTokens, setProcessedTokens] = useState<ProcessedToken[]>([]);
  
  useEffect(() => {
    async function processBalances() {
      if (!tokenBalances.balances || tokenBalances.balances.length === 0) {
        setProcessedTokens([]);
        return;
      }

      try {
        // Get base token address for comparison
        const provider = typeof window !== 'undefined' ? window.keeta : null;
        const baseTokenInfo = provider ? await provider.getBaseToken?.() : null;
        const baseTokenAddress = baseTokenInfo && typeof baseTokenInfo === 'object' && baseTokenInfo !== null && 'address' in baseTokenInfo
          ? (baseTokenInfo as { address?: string }).address
          : null;

        const processed = await Promise.all(
          (tokenBalances.balances as KeetaBalanceEntry[]).map(async (entry) => {
            return processTokenForDisplay(
              entry.token,
              entry.balance,
              entry.metadata,
              baseTokenAddress
            );
          })
        );

        setProcessedTokens(processed);
      } catch (error) {
        console.error('Failed to process token balances:', error);
        setProcessedTokens([]);
      }
    }

    processBalances();
  }, [tokenBalances.balances]);
  
  const signMessage = useCallback(async (message: string) => {
    if (typeof window === 'undefined') {
      throw new Error('signMessage is only available in the browser context');
    }

    const provider = window.keeta;
    if (!provider || typeof provider.signMessage !== 'function') {
      throw new Error('Keeta provider does not support message signing');
    }

    return provider.signMessage(message);
  }, []);

  // Derive clear, unambiguous state indicators
  const contextValue = useMemo<WalletContextValue>(() => {
    const { wallet } = walletData;
    const primaryAccount = wallet.accounts?.[0] ?? null;

    // During initialization, don't show locked state until we've actually checked
    const isStillInitializing = wallet.isInitializing;

    // Three distinct states:
    // 1. isDisconnected: No wallet connected at all
    // 2. isLocked: Wallet connected but locked (user needs to unlock) - only after initialization
    // 3. isUnlocked: Wallet connected and unlocked (ready to use)

    const isDisconnected = !wallet.connected;
    // Only show locked state if we're done initializing AND actually locked
    const isLocked = !isStillInitializing && wallet.connected && wallet.isLocked;
    const isUnlocked = !isStillInitializing && wallet.connected && !wallet.isLocked;
    const isConnected = wallet.connected && !wallet.isLocked;

    return {
      // Wallet data
      wallet,
      error: walletData.error,
      isLoading: walletData.isLoading,
      connectWallet: walletData.connectWallet,
      refreshWallet: walletData.refreshWallet,
      fetchWalletState: walletData.fetchWalletState,

      // Derived state indicators
      isDisconnected,
      isLocked,
      isUnlocked,
      isConnected,
      publicKey: primaryAccount,
      signMessage: !primaryAccount ? null : signMessage,
      userClient: null, // Simplified implementation - userClient not available

      // Legacy properties for backward compatibility
      isWalletLoading: walletData.isLoading,
      isWalletFetching: walletData.isLoading,
      walletError: walletData.error,

      // Token-related properties
      tokens: processedTokens,
      isTokensLoading: tokenBalances.isLoading,
      isTokensFetching: tokenBalances.isLoading,
      tokensError: tokenBalances.error,
    };
  }, [signMessage, walletData, tokenBalances, processedTokens]);

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
}

/**
 * useWallet - Hook to access wallet state from any component
 * 
 * @returns {Object} Wallet state and methods
 * @property {boolean} isDisconnected - True if no wallet is connected
 * @property {boolean} isLocked - True if wallet is connected but locked
 * @property {boolean} isUnlocked - True if wallet is connected and unlocked
 * @property {Object} wallet - Full wallet state object
 * @property {Array} tokens - Array of token balances
 * @property {Function} connectWallet - Function to connect wallet
 * @property {Function} refreshWallet - Function to refresh wallet state
 * @property {string} formattedBalance - Formatted balance string
 * @property {boolean} isWalletLoading - True if wallet is loading
 * @property {boolean} isTokensLoading - True if tokens are loading
 */
export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }

  return context;
}

