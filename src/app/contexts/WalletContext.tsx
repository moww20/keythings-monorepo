"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import { useWalletData, type WalletData } from "../hooks/useWalletData";

interface WalletContextValue extends WalletData {
  isDisconnected: boolean;
  isLocked: boolean;
  isUnlocked: boolean;
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

  // Derive clear, unambiguous state indicators
  const contextValue = useMemo<WalletContextValue>(() => {
    const { wallet } = walletData;

    // Three distinct states:
    // 1. isDisconnected: No wallet connected at all
    // 2. isLocked: Wallet connected but locked (user needs to unlock)
    // 3. isUnlocked: Wallet connected and unlocked (ready to use)
    
    const isDisconnected = !wallet.connected;
    const isLocked = wallet.connected && wallet.isLocked;
    const isUnlocked = wallet.connected && !wallet.isLocked;

    return {
      // Spread all original wallet data
      ...walletData,
      
      // Add clear state indicators
      isDisconnected,
      isLocked,
      isUnlocked,
      
      // Keep wallet object for backward compatibility
      wallet,
    };
  }, [walletData]);

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

