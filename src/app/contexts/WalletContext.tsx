"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useWalletData, useTokenBalances } from "../hooks/useWalletData";
import type { ProcessedToken } from "../lib/token-utils";
import {
  processTokenForDisplay,
  fromBaseUnits,
  toBaseUnits,
  getMakerTokenAddressFromOrder,
  getTakerTokenAddressFromOrder,
  getMakerTokenDecimalsFromOrder,
  getTakerTokenDecimalsFromOrder,
  setTokenAddressCache,
  setTokenDecimalsCache,
} from "../lib/token-utils";
import type { KeetaUserClient, KeetaBalanceEntry } from "../../types/keeta";
import {
  StorageAccountManager,
  normalizeAccountRef,
  normalizePublicKeyString,
  extractBlockHash,
} from "../lib/storage-account-manager";
import type {
  RFQStorageAccountDetails,
  RFQStorageCreationResult,
  RFQFillDetails,
  RFQFillResult,
  RFQCancelDetails,
  RFQCancelResult,
  StorageAccountState,
  StorageAccountPermission,
} from '@/app/types/rfq-blockchain';
import type { RFQOrder } from '@/app/types/rfq';

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

function safeBigIntFrom(value: unknown): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.floor(value));
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      return BigInt(value.trim());
    } catch {
      return BigInt(0);
    }
  }
  return BigInt(0);
}

function decodeMetadataBase64(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  try {
    const json =
      typeof atob === 'function'
        ? atob(value)
        : Buffer.from(value, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

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

  // createRFQStorageAccount removed - use two-step pattern in RFQMakerPanel instead
  fillRFQOrder: (details: RFQFillDetails) => Promise<RFQFillResult>;
  cancelRFQOrder: (details: RFQCancelDetails) => Promise<RFQCancelResult>;
  verifyStorageAccount: (storageAddress: string) => Promise<StorageAccountState>;
  getStorageAccountPermissions: (storageAddress: string) => Promise<StorageAccountPermission[]>;
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
  
  // Keeta SDK user client state
  const [userClient, setUserClient] = useState<KeetaUserClient | null>(null);
  
  // Debug: Log whenever userClient changes
  useEffect(() => {
    console.log('[WalletContext] userClient state changed:', {
      hasClient: !!userClient,
      type: typeof userClient,
      methods: userClient ? Object.keys(userClient).filter(k => typeof userClient[k as keyof KeetaUserClient] === 'function').slice(0, 10) : []
    });
  }, [userClient]);
  
  // Initialize userClient when wallet unlocks
  useEffect(() => {
    const initUserClient = async () => {
      // Clear client if wallet disconnected or locked
      if (!walletData.wallet.connected || walletData.wallet.isLocked) {
        console.log('[WalletContext] Clearing userClient (wallet locked/disconnected)');
        setUserClient(null);
        return;
      }
      
      if (typeof window === 'undefined' || !window.keeta) {
        return;
      }
      
      const provider = window.keeta;
      console.log('[WalletContext] Initializing Keeta SDK user client...');
      
      try {
        // Method 1: Try getUserClient() (async)
        if (typeof provider.getUserClient === 'function') {
          const client = await provider.getUserClient();
          console.log('[WalletContext] getUserClient() returned:', {
            hasClient: !!client,
            type: typeof client,
            hasInitBuilder: client ? typeof client.initBuilder : 'n/a',
            methods: client ? Object.keys(client).slice(0, 10) : []
          });
          if (client && typeof client.initBuilder === 'function') {
            console.log('[WalletContext] ✅ Got userClient via getUserClient() - SETTING STATE NOW');
            setUserClient(client as KeetaUserClient);
            console.log('[WalletContext] State updated, userClient should be available');
            return;
          }
        }
        
        // Method 2: Try createUserClient() (async)
        if (typeof provider.createUserClient === 'function') {
          const client = await provider.createUserClient();
          if (client && typeof client.initBuilder === 'function') {
            console.log('[WalletContext] ✅ Got userClient via createUserClient()');
            setUserClient(client as KeetaUserClient);
            return;
          }
        }
        
        // Method 3: Use provider directly if it has methods
        const providerAny = provider as any;
        if (typeof providerAny.initBuilder === 'function' && 
            typeof providerAny.publishBuilder === 'function') {
          console.log('[WalletContext] ✅ Using provider directly as userClient');
          setUserClient(providerAny as KeetaUserClient);
          return;
        }
        
        console.warn('[WalletContext] Could not initialize userClient - no suitable method found');
        setUserClient(null);
      } catch (error) {
        console.error('[WalletContext] Error initializing userClient:', error);
        setUserClient(null);
      }
    };
    
    initUserClient();
  }, [walletData.wallet.connected, walletData.wallet.isLocked]);
  
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

        // Update token address and decimals cache with real data from wallet
        const tokenAddressMap = new Map<string, string>();
        const tokenDecimalsMap = new Map<string, number>();
        (tokenBalances.balances as KeetaBalanceEntry[]).forEach((entry) => {
          const processedToken = processed.find(p => p.address === entry.token);
          if (processedToken) {
            // Map common token symbols to their addresses and decimals
            const symbol = processedToken.ticker.toUpperCase();
            if (symbol === 'KTA' || symbol === 'BASE' || symbol === 'USDT' || symbol === 'USDC') {
              tokenAddressMap.set(symbol, entry.token);
              tokenDecimalsMap.set(symbol, processedToken.decimals);
            }
          }
        });
        setTokenAddressCache(tokenAddressMap);
        setTokenDecimalsCache(tokenDecimalsMap);

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

  const walletAddress = walletData.wallet.accounts?.[0] ?? '';

  // createRFQStorageAccount method removed - use two-step pattern in RFQMakerPanel instead:
  // Step 1: manager.createStorageAccount() - creates empty storage account only
  // Step 2: separate transaction with setInfo() + send() - configures and funds

  const validateAtomicSwapTerms = useCallback(async (
    order: RFQOrder,
    fillAmount: number,
    storageAddress: string,
  ): Promise<boolean> => {
    try {
      // Fetch storage account info to get metadata
      const provider = window.keeta;
      if (!provider?.getAccountInfo) return true; // Skip validation if not available
      
      const accountInfo = await provider.getAccountInfo(storageAddress);
      const metadata = (accountInfo as any)?.metadata;
      
      if (!metadata) return true; // No metadata to validate against
      
      // Parse metadata
      const metadataStr = typeof metadata === 'string' 
        ? atob(metadata) 
        : JSON.stringify(metadata);
      const metadataObj = JSON.parse(metadataStr);
      
      if (!metadataObj.atomicSwap) return true; // No swap terms defined
      
      // Validate swap terms match
      const swap = metadataObj.atomicSwap;
      const makerTokenAddress = getMakerTokenAddressFromOrder(order);
      const takerTokenAddress = getTakerTokenAddressFromOrder(order);
      
      const isValid = 
        swap.makerToken === makerTokenAddress &&
        swap.takerToken === takerTokenAddress &&
        swap.recipient === order.maker.id;
      
      return isValid;
    } catch (error) {
      console.warn('[validateAtomicSwapTerms] Validation failed:', error);
      return true; // Allow transaction if validation fails (fail open)
    }
  }, []);

  const getStorageAccountPermissions = useCallback(async (storageAddress: string): Promise<StorageAccountPermission[]> => {
    let permissions: StorageAccountPermission[] = [];
    if (userClient && typeof userClient.listACLsByEntity === 'function') {
      try {
        const aclEntries = await userClient.listACLsByEntity({ account: { publicKeyString: storageAddress } });
        if (Array.isArray(aclEntries)) {
          permissions = aclEntries.map((acl) => ({
            principal: normalizePublicKeyString(acl.principal) ?? '',
            flags:
              (Array.isArray(acl.permissions?.base?.flags)
                ? acl.permissions.base.flags
                : []) as string[],
            target: normalizePublicKeyString(acl.target) ?? null,
          }));
        }
      } catch (error) {
        console.error('Error fetching ACLs by entity:', error);
      }
    }
    return permissions;
  }, [userClient]);

  const fillRFQOrder = useCallback(
    async ({ order, fillAmount, takerAddress }: RFQFillDetails): Promise<RFQFillResult> => {
      if (!userClient || !walletAddress) {
        throw new Error('Connect your wallet to settle RFQ orders.');
      }

      const storageAddress = order.storageAccount ?? order.unsignedBlock;
      if (!storageAddress) {
        throw new Error('RFQ order is missing a storage account reference.');
      }

      const builder = userClient.initBuilder();
      if (!builder) {
        throw new Error('Wallet did not provide a transaction builder for RFQ settlement.');
      }

      const sendFn = (builder as { send?: (...args: unknown[]) => unknown }).send;
      if (typeof sendFn !== 'function') {
        throw new Error('Wallet builder does not expose a send method.');
      }

      // Validate all required values before creating objects
      if (!order.maker.id) {
        throw new Error('Maker ID is missing from order');
      }
      if (!storageAddress) {
        throw new Error('Storage address is missing from order');
      }

      const makerTokenAddress = getMakerTokenAddressFromOrder(order);
      const takerTokenAddress = getTakerTokenAddressFromOrder(order);
      if (!makerTokenAddress || !takerTokenAddress) {
        throw new Error('RFQ order does not specify token addresses for settlement.');
      }

      // Create serializable objects for Chrome messaging (following CreatePoolModal pattern)
      const makerAccount = JSON.parse(JSON.stringify({ publicKeyString: order.maker.id }));
      const takerAccount = JSON.parse(JSON.stringify({ publicKeyString: takerAddress ?? walletAddress }));
      const storageAccount = JSON.parse(JSON.stringify({ publicKeyString: storageAddress }));
      const makerToken = JSON.parse(JSON.stringify({ publicKeyString: makerTokenAddress }));
      const takerToken = JSON.parse(JSON.stringify({ publicKeyString: takerTokenAddress }));

      const makerDecimals = getMakerTokenDecimalsFromOrder(order);
      const takerDecimals = getTakerTokenDecimalsFromOrder(order);
      const takerAmount = toBaseUnits(fillAmount, takerDecimals);
      const makerAmount = toBaseUnits(fillAmount * order.price, makerDecimals);

      console.log('[fillRFQOrder] Atomic swap parameters:', {
        makerAccount,
        takerAccount,
        storageAccount,
        makerToken,
        takerToken,
        takerAmount,
        makerAmount
      });

      // NEW: Validate atomic swap terms
      const isValidSwap = await validateAtomicSwapTerms(order, fillAmount, storageAddress);
      if (!isValidSwap) {
        throw new Error('Atomic swap terms validation failed - swap constraints do not match storage account');
      }
      
      console.log('[fillRFQOrder] ✅ Atomic swap terms validated');

      // NEW: Verify taker has SEND_ON_BEHALF permission (declaration-based flow)
      const permissions = await getStorageAccountPermissions(storageAddress);
      const hasSendPermission = permissions.some(
        p => p.principal === (takerAddress ?? walletAddress) && p.flags.includes('SEND_ON_BEHALF')
      );
      
      if (!hasSendPermission) {
        throw new Error('Taker not approved for this order. Please declare intention first and wait for maker approval.');
      }
      
      console.log('[fillRFQOrder] ✅ Taker has SEND_ON_BEHALF permission');

      // Step 1: Taker sends their token to maker
      await Promise.resolve(
        sendFn.call(builder, makerAccount, takerAmount, takerToken),
      );
      
      // Step 2: Taker withdraws maker's token from storage account
      await Promise.resolve(
        sendFn.call(builder, takerAccount, makerAmount, makerToken, undefined, {
          account: storageAccount,
        }),
      );

      const receipt = await userClient.publishBuilder(builder);
      return { blockHash: extractBlockHash(receipt) ?? null } satisfies RFQFillResult;
    },
    [userClient, walletAddress, validateAtomicSwapTerms, getStorageAccountPermissions],
  );

  const cancelRFQOrder = useCallback(
    async ({ order, tokenAddress, tokenDecimals, amount }: RFQCancelDetails): Promise<RFQCancelResult> => {
      if (!userClient || !walletAddress) {
        throw new Error('Connect your wallet to cancel RFQ orders.');
      }

      const storageAddress = order.storageAccount ?? order.unsignedBlock;
      if (!storageAddress) {
        throw new Error('RFQ order is missing a storage account reference.');
      }

      const builder = userClient.initBuilder();
      if (!builder) {
        throw new Error('Wallet did not provide a transaction builder for cancellation.');
      }

      const sendFn = (builder as { send?: (...args: unknown[]) => unknown }).send;
      if (typeof sendFn !== 'function') {
        throw new Error('Wallet builder does not expose a send method.');
      }

      const storageAccount = JSON.parse(JSON.stringify({ publicKeyString: storageAddress }));
      const destinationAccount = JSON.parse(JSON.stringify({ publicKeyString: walletAddress }));
      const tokenAccount = JSON.parse(JSON.stringify({ publicKeyString: tokenAddress }));
      const withdrawalAmount = toBaseUnits(amount, tokenDecimals);

      await Promise.resolve(
        sendFn.call(builder, destinationAccount, withdrawalAmount, tokenAccount, undefined, {
          account: storageAccount,
        }),
      );

      const receipt = await userClient.publishBuilder(builder);
      return { blockHash: extractBlockHash(receipt) ?? null } satisfies RFQCancelResult;
    },
    [userClient, walletAddress],
  );

  const verifyStorageAccount = useCallback(
    async (storageAddress: string): Promise<StorageAccountState> => {
      if (!storageAddress) {
        throw new Error('Storage account address is required for verification.');
      }

      if (typeof window === 'undefined') {
        throw new Error('Storage account verification is only available in the browser.');
      }

      const provider = window.keeta;
      if (!provider || typeof provider.getAccountInfo !== 'function') {
        throw new Error('Keeta wallet provider does not expose getAccountInfo.');
      }

      const rawInfo = await provider.getAccountInfo(storageAddress);
      const infoObject =
        rawInfo && typeof rawInfo === 'object'
          ? (rawInfo as Record<string, unknown>)
          : ({} as Record<string, unknown>);

      const metadataBase64 =
        typeof infoObject.metadata === 'string'
          ? infoObject.metadata
          : typeof (infoObject.info as Record<string, unknown> | undefined)?.metadata === 'string'
            ? ((infoObject.info as Record<string, unknown>).metadata as string)
            : undefined;

      const balancesSource = Array.isArray(infoObject.balances)
        ? (infoObject.balances as unknown[])
        : Array.isArray((infoObject.info as Record<string, unknown> | undefined)?.balances)
          ? (((infoObject.info as Record<string, unknown>).balances as unknown[]))
          : [];

      const balances = balancesSource.map((entry) => {
        const balanceRecord = (entry ?? {}) as Record<string, unknown>;
        const token = typeof balanceRecord.token === 'string' ? balanceRecord.token : '';
        const decimals = typeof balanceRecord.decimals === 'number' ? balanceRecord.decimals : 0;
        const amount = safeBigIntFrom(balanceRecord.balance ?? balanceRecord.amount);
        return {
          token,
          amount,
          decimals,
          normalizedAmount: fromBaseUnits(amount, decimals),
        };
      });

      let permissions: StorageAccountPermission[] = [];
      if (userClient && typeof userClient.listACLsByEntity === 'function') {
        try {
          const aclEntries = await userClient.listACLsByEntity({ account: { publicKeyString: storageAddress } });
          if (Array.isArray(aclEntries)) {
            permissions = aclEntries.map((acl) => ({
              principal: normalizePublicKeyString(acl.principal) ?? '',
              flags:
                (Array.isArray(acl.permissions?.base?.flags)
                  ? (acl.permissions.base.flags as string[])
                  : []) ?? [],
              target: acl.target ? normalizePublicKeyString(acl.target) : null,
            }));
          }
        } catch (error) {
          console.warn('[WalletContext] Unable to load storage permissions', error);
        }
      }

      return {
        address: storageAddress,
        metadata: metadataBase64 ? decodeMetadataBase64(metadataBase64) : undefined,
        balances,
        permissions,
        raw: rawInfo,
      } satisfies StorageAccountState;
    },
    [userClient],
  );

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
      userClient, // Keeta SDK client for building and signing transactions

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
      // createRFQStorageAccount removed
      fillRFQOrder,
      cancelRFQOrder,
      verifyStorageAccount,
      getStorageAccountPermissions,
    };
  }, [
    signMessage,
    walletData,
    tokenBalances,
    processedTokens,
    isTradingEnabled,
    isTradingEnabling,
    tradingError,
    storageAccountAddress,
    enableTrading,
    userClient,
    // createRFQStorageAccount removed
    fillRFQOrder,
    cancelRFQOrder,
    verifyStorageAccount,
    getStorageAccountPermissions,
  ]);

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

