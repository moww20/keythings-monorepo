"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useWalletData, useTokenBalances } from "../hooks/useWalletData";
import type { ProcessedToken } from "../lib/token-utils";
import { processTokenForDisplay } from "../lib/token-utils";
import type { KeetaUserClient, KeetaBalanceEntry } from "../../types/keeta";
import { StorageAccountManager } from "../lib/storage-account-manager";

// Exchange operator public key - TODO: Move to environment variable
const EXCHANGE_OPERATOR_PUBKEY = process.env.NEXT_PUBLIC_EXCHANGE_OPERATOR_PUBKEY || "PLACEHOLDER_OPERATOR_PUBKEY";

// Allowed tokens for trading - TODO: Fetch from backend
const ALLOWED_TOKENS = [
  process.env.NEXT_PUBLIC_USDT_TOKEN_PUBKEY || "PLACEHOLDER_USDT",
  process.env.NEXT_PUBLIC_USDX_TOKEN_PUBKEY || "PLACEHOLDER_USDX",
  process.env.NEXT_PUBLIC_KTA_TOKEN_PUBKEY || "PLACEHOLDER_KTA",
];

// Zod schema for trading status API response
const TradingStatusSchema = z.object({
  trading_enabled: z.boolean(),
  storage_account: z.string().nullable(),
});

// Zod schema for registration response
const RegistrationResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
});

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
  
  // Trading enablement properties
  isTradingEnabled: boolean;
  isTradingEnabling: boolean;
  tradingError: string | null;
  storageAccountAddress: string | null;
  enableTrading: () => Promise<void>;
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
  
  // Trading enablement state
  const [isTradingEnabled, setIsTradingEnabled] = useState(false);
  const [isTradingEnabling, setIsTradingEnabling] = useState(false);
  const [tradingError, setTradingError] = useState<string | null>(null);
  const [storageAccountAddress, setStorageAccountAddress] = useState<string | null>(null);
  
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
  
  // Check if trading is already enabled for this user
  useEffect(() => {
    const checkTradingEnabled = async () => {
      const primaryAccount = walletData.wallet.accounts?.[0];
      if (!primaryAccount || !walletData.wallet.connected || walletData.wallet.isLocked) {
        setIsTradingEnabled(false);
        setStorageAccountAddress(null);
        return;
      }

      try {
        // Check if user has storage account registered with backend
        const apiUrl = process.env.NEXT_PUBLIC_DEX_API_URL || 'http://localhost:8080';
        const response = await fetch(
          `${apiUrl}/api/users/${encodeURIComponent(primaryAccount)}/status`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            // Add timeout to prevent hanging
            signal: AbortSignal.timeout(5000), // 5 second timeout
          }
        );

        if (response.ok) {
          const rawData = await response.json();
          
          // Validate response with Zod
          const result = TradingStatusSchema.safeParse(rawData);
          
          if (!result.success) {
            console.warn('Invalid trading status response:', result.error);
            setIsTradingEnabled(false);
            setStorageAccountAddress(null);
            return;
          }
          
          setIsTradingEnabled(result.data.trading_enabled);
          setStorageAccountAddress(result.data.storage_account);
        } else {
          // Backend returned error status - trading not enabled
          setIsTradingEnabled(false);
          setStorageAccountAddress(null);
        }
      } catch (error) {
        // Network error or timeout - silently handle and assume trading not enabled
        // This is expected if the backend is not running
        if (error instanceof Error && error.name !== 'AbortError') {
          // Only log non-timeout errors for debugging
          console.debug('Trading backend not available:', error.message);
        }
        setIsTradingEnabled(false);
        setStorageAccountAddress(null);
      }
    };

    checkTradingEnabled();
  }, [walletData.wallet.accounts, walletData.wallet.connected, walletData.wallet.isLocked]);

  const enableTrading = useCallback(async () => {
    if (isTradingEnabling) {
      return; // Prevent multiple concurrent calls
    }

    const primaryAccount = walletData.wallet.accounts?.[0];
    if (!primaryAccount) {
      setTradingError('No wallet account found. Please connect your wallet.');
      return;
    }

    setIsTradingEnabling(true);
    setTradingError(null);

    try {
      // Get user client from window.keeta provider
      if (typeof window === 'undefined') {
        throw new Error('Window is not available');
      }

      const provider = window.keeta;
      if (!provider) {
        throw new Error('Keeta wallet not found. Please install Keeta Wallet extension.');
      }

      // Try multiple methods to get user client
      let userClient: any = null;

      // Method 1: Try getUserClient()
      if (typeof provider.getUserClient === 'function') {
        try {
          userClient = await provider.getUserClient();
        } catch (err) {
          console.warn('getUserClient() failed:', err);
        }
      }

      // Method 2: Try createUserClient()
      if (!userClient && typeof provider.createUserClient === 'function') {
        try {
          userClient = await provider.createUserClient();
        } catch (err) {
          console.warn('createUserClient() failed:', err);
        }
      }

      // Method 3: Check if provider itself has builder methods
      if (!userClient) {
        const providerAsClient = provider as any;
        if (typeof providerAsClient.initBuilder === 'function' && typeof providerAsClient.publishBuilder === 'function') {
          console.log('Using provider directly as user client');
          userClient = providerAsClient;
        }
      }

      if (!userClient) {
        throw new Error(
          'Your Keeta Wallet version does not support storage account creation yet. ' +
          'Please update to the latest version of Keeta Wallet or contact support.'
        );
      }

      // Validate user client has required methods
      if (typeof userClient.initBuilder !== 'function' || typeof userClient.publishBuilder !== 'function') {
        throw new Error(
          'User client does not support required builder methods. ' +
          'Please update your Keeta Wallet to the latest version.'
        );
      }

      // Create storage account manager
      const manager = new StorageAccountManager(userClient);

      // Create storage account with permissions
      console.log('Creating storage account for trading...');
      const storageAccount = await manager.createStorageAccount(
        EXCHANGE_OPERATOR_PUBKEY,
        ALLOWED_TOKENS
      );

      console.log('Storage account created:', storageAccount);
      setStorageAccountAddress(storageAccount);

      // Register with backend
      const apiUrl = process.env.NEXT_PUBLIC_DEX_API_URL || 'http://localhost:8080';
      const response = await fetch(
        `${apiUrl}/api/users/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: primaryAccount,
            storage_account: storageAccount,
          }),
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(10000), // 10 second timeout
        }
      );

      if (!response.ok) {
        const rawErrorData = await response.json().catch(() => null);
        
        // Validate error response with Zod
        const errorResult = rawErrorData ? RegistrationResponseSchema.safeParse(rawErrorData) : null;
        const errorMessage = errorResult?.success && errorResult.data.message
          ? errorResult.data.message
          : 'Failed to register with exchange backend';
        
        throw new Error(errorMessage);
      }

      // Validate successful response
      const rawData = await response.json();
      const result = RegistrationResponseSchema.safeParse(rawData);
      
      if (!result.success) {
        console.warn('Invalid registration response:', result.error);
      }

      console.log('Successfully registered with exchange backend');
      setIsTradingEnabled(true);
      setTradingError(null);
    } catch (error) {
      console.error('Failed to enable trading:', error);
      setTradingError(
        error instanceof Error ? error.message : 'An unknown error occurred while enabling trading'
      );
      setIsTradingEnabled(false);
    } finally {
      setIsTradingEnabling(false);
    }
  }, [isTradingEnabling, walletData.wallet.accounts]);

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
      
      // Trading enablement properties
      isTradingEnabled,
      isTradingEnabling,
      tradingError,
      storageAccountAddress,
      enableTrading,
    };
  }, [signMessage, walletData, tokenBalances, processedTokens, isTradingEnabled, isTradingEnabling, tradingError, storageAccountAddress, enableTrading]);

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

