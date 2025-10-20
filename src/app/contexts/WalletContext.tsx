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
  setTokenAddressCache,
  setTokenDecimalsCache,
  extractDecimalsAndFieldType,
} from "../lib/token-utils";
import type { KeetaUserClient, KeetaBalanceEntry } from "../../types/keeta";
import {
  StorageAccountManager,
  normalizeAccountRef,
  normalizePublicKeyString,
  extractBlockHash,
} from "../lib/storage-account-manager";
import { decodeFromBase64 } from "../lib/encoding";
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
const rawExchangeOperatorPubkey = process.env.NEXT_PUBLIC_EXCHANGE_OPERATOR_PUBKEY;
const EXCHANGE_OPERATOR_PUBKEY: string | null = typeof rawExchangeOperatorPubkey === 'string' && rawExchangeOperatorPubkey.length > 0
  ? rawExchangeOperatorPubkey
  : null;

// Allowed tokens for trading - TODO: Fetch from backend
const ALLOWED_TOKENS = [
  process.env.NEXT_PUBLIC_USDT_TOKEN_PUBKEY,
  process.env.NEXT_PUBLIC_USDX_TOKEN_PUBKEY,
  process.env.NEXT_PUBLIC_KTA_TOKEN_PUBKEY,
].filter((token): token is string => typeof token === 'string' && token.length > 0);

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
    const json = decodeFromBase64(value);
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
  connectWallet: (requestCapabilities?: boolean) => Promise<void>;
  requestTransactionPermissions: () => Promise<boolean>;
  hasTransactionPermissions: boolean;
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
  getTokenMetadata: (tokenAddress: string) => Promise<{ decimals: number; fieldType: 'decimalPlaces' | 'decimals'; name?: string; symbol?: string; ticker?: string; metadata?: string } | null>;
  
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
  signAtomicSwapDeclaration: (params: {
    unsignedBlockHex?: string | null;
    unsignedBlockJson?: unknown;
  }) => Promise<{ published: boolean; blockHash?: string | null; signedBlock?: string | null }>;
  grantStoragePermission: (
    storageAddress: string,
    operatorAddress: string,
    tokenAddress: string,
  ) => Promise<void>;
  revokeStoragePermission: (
    storageAddress: string,
    operatorAddress: string,
  ) => Promise<void>;
  withdrawFromStorage: (
    storageAddress: string,
    destinationAddress: string,
    tokenAddress: string,
    amount: string,
    decimals: number,
  ) => Promise<string>;
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
  
  // Capability state & Keeta SDK client
  const [hasTransactionPermissions, setHasTransactionPermissions] = useState(false);
  const [userClient, setUserClient] = useState<KeetaUserClient | null>(null);

  // Trading state
  const [isTradingEnabled, setIsTradingEnabled] = useState(false);
  const [isTradingEnabling, setIsTradingEnabling] = useState(false);
  const [tradingError, setTradingError] = useState<string | null>(null);
  const [storageAccountAddress, setStorageAccountAddress] = useState<string | null>(null);
  
  // Debug: Log whenever userClient changes
  useEffect(() => {
    console.log('[WalletContext] userClient state changed:', {
      hasClient: !!userClient,
      type: typeof userClient,
      methods: userClient ? Object.keys(userClient).filter(k => typeof userClient[k as keyof KeetaUserClient] === 'function').slice(0, 10) : []
    });
  }, [userClient]);
  
  // Reset permission state when wallet disconnects or locks
  useEffect(() => {
    if (!walletData.wallet.connected || walletData.wallet.isLocked) {
      setHasTransactionPermissions(false);
    }
  }, [walletData.wallet.connected, walletData.wallet.isLocked]);

  // Initialize userClient when wallet unlocks and permissions granted
  useEffect(() => {
    const initUserClient = async () => {
      // Clear client if wallet disconnected or locked
      if (!walletData.wallet.connected || walletData.wallet.isLocked) {
        console.log('[WalletContext] Clearing userClient (wallet locked/disconnected)');
        setUserClient(null);
        return;
      }

      if (!hasTransactionPermissions) {
        console.log('[WalletContext] Waiting for transaction permissions before initializing userClient');
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
  }, [walletData.wallet.connected, walletData.wallet.isLocked, hasTransactionPermissions]);
  
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

  const requestTransactionPermissions = useCallback(async (): Promise<boolean> => {
    try {
      await walletData.fetchWalletState(true);
      setHasTransactionPermissions(true);
      return true;
    } catch (error) {
      console.error('[WalletContext] Failed to request transaction permissions:', error);
      setHasTransactionPermissions(false);
      return false;
    }
  }, [walletData]);

  const walletAddress = walletData.wallet.accounts?.[0] ?? '';

  // createRFQStorageAccount method removed - use two-step pattern in RFQMakerPanel instead:
  // Step 1: manager.createStorageAccount() - creates empty storage account only
  // Step 2: separate transaction with setInfo() + send() - configures and funds

  const validateAtomicSwapTerms = useCallback(
    async (order: RFQOrder, fillAmount: number, storageAddress: string): Promise<boolean> => {
      try {
        const provider = window.keeta;
        if (!provider?.getAccountInfo) {
          console.error('[validateAtomicSwapTerms] Wallet provider does not expose getAccountInfo');
          return false;
        }

        const accountInfo = await provider.getAccountInfo(storageAddress);
        const metadata = (accountInfo as Record<string, unknown>)?.metadata;

        if (!metadata || (typeof metadata !== 'string' && typeof metadata !== 'object')) {
          console.error('[validateAtomicSwapTerms] Storage account is missing atomic swap metadata');
          return false;
        }

        const metadataJson =
          typeof metadata === 'string' ? decodeFromBase64(metadata) : JSON.stringify(metadata);

        const metadataObj = JSON.parse(metadataJson) as Record<string, unknown>;
        const swap = metadataObj?.atomicSwap as
          | {
              makerToken?: string;
              takerToken?: string;
              takerAmount?: string;
              makerAmount?: string;
              recipient?: string;
            }
          | undefined;

        if (!swap) {
          console.error('[validateAtomicSwapTerms] Atomic swap metadata missing from storage account');
          return false;
        }

        const makerTokenAddress = getMakerTokenAddressFromOrder(order);
        const takerTokenAddress = getTakerTokenAddressFromOrder(order);

        const expectedMakerAmount = fillAmount * order.price;

        const makerMatches = swap.makerToken === makerTokenAddress;
        const takerMatches = swap.takerToken === takerTokenAddress;
        const recipientMatches = swap.recipient === order.maker.id;
        const amountHintsPresent = Boolean(swap.makerAmount) && Boolean(swap.takerAmount);

        if (!makerMatches || !takerMatches || !recipientMatches || !amountHintsPresent) {
          console.error('[validateAtomicSwapTerms] Atomic swap metadata mismatches detected', {
            swap,
            makerTokenAddress,
            takerTokenAddress,
            makerId: order.maker.id,
            fillAmount,
            expectedMakerAmount,
          });
          return false;
        }

        return true;
      } catch (error) {
        console.error('[validateAtomicSwapTerms] Validation failed:', error);
        return false;
      }
    },
    [],
  );

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
      const receiveFn = (builder as { receive?: (...args: unknown[]) => unknown }).receive;
      if (typeof receiveFn !== 'function') {
        throw new Error('Wallet builder does not expose a receive method.');
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

      // Fetch token metadata from blockchain instead of using cache
      let makerDecimals = 0;
      let takerDecimals = 0;
      
      try {
        // Handle base token specially
        if (makerTokenAddress === 'base' || makerTokenAddress === (userClient.baseToken as any)?.publicKeyString) {
          const baseTokenInfo = userClient.baseToken;
          if (baseTokenInfo && typeof baseTokenInfo === 'object' && 'info' in baseTokenInfo) {
            const info = (baseTokenInfo as any).info;
            const metadata = info?.metadata;
            if (metadata) {
              const { decimals } = extractDecimalsAndFieldType(metadata);
              makerDecimals = decimals;
            }
          }
        } else {
          // For regular tokens, try to get from account state
          if ('getAccountState' in userClient && typeof userClient.getAccountState === 'function') {
            const accountState = await userClient.getAccountState(makerTokenAddress);
            if (accountState?.info?.metadata) {
              const { decimals } = extractDecimalsAndFieldType(accountState.info.metadata);
              makerDecimals = decimals;
            }
          }
        }
        
        // Same logic for taker token
        if (takerTokenAddress === 'base' || takerTokenAddress === (userClient.baseToken as any)?.publicKeyString) {
          const baseTokenInfo = userClient.baseToken;
          if (baseTokenInfo && typeof baseTokenInfo === 'object' && 'info' in baseTokenInfo) {
            const info = (baseTokenInfo as any).info;
            const metadata = info?.metadata;
            if (metadata) {
              const { decimals } = extractDecimalsAndFieldType(metadata);
              takerDecimals = decimals;
            }
          }
        } else {
          // For regular tokens, try to get from account state
          if ('getAccountState' in userClient && typeof userClient.getAccountState === 'function') {
            const accountState = await userClient.getAccountState(takerTokenAddress);
            if (accountState?.info?.metadata) {
              const { decimals } = extractDecimalsAndFieldType(accountState.info.metadata);
              takerDecimals = decimals;
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch token metadata:', error);
        throw new Error('Failed to fetch token metadata from blockchain');
      }
      const makerAmount = toBaseUnits(fillAmount, makerDecimals);
      const takerNotional = fillAmount * order.price;
      const takerAmount = toBaseUnits(takerNotional, takerDecimals);

      // NEW: Validate atomic swap terms
      const isValidSwap = await validateAtomicSwapTerms(order, fillAmount, storageAddress);
      if (!isValidSwap) {
        throw new Error('Atomic swap terms validation failed - swap constraints do not match storage account');
      }
      // NEW: Verify taker has SEND_ON_BEHALF permission (declaration-based flow)
      const permissions = await getStorageAccountPermissions(storageAddress);
      const hasSendPermission = permissions.some(
        p => p.principal === (takerAddress ?? walletAddress) && p.flags.includes('SEND_ON_BEHALF')
      );
      
      if (!hasSendPermission) {
        throw new Error('Taker not approved for this order. Please declare intention first and wait for maker approval.');
      }
      
      // Step 1: Escrow releases maker funds to the taker
      await Promise.resolve(receiveFn.call(builder, storageAccount, makerAmount, makerToken));

      // Step 2: Taker delivers their side of the swap back to the maker
      await Promise.resolve(sendFn.call(builder, makerAccount, takerAmount, takerToken));

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

      // Use string addresses directly instead of wrapped objects
      const destinationAccount = walletAddress;
      
      const normalizedTokenAddress =
        typeof tokenAddress === 'string' ? tokenAddress.trim() : '';
      const isPlaceholderToken =
        normalizedTokenAddress.length === 0 ||
        normalizedTokenAddress.startsWith('PLACEHOLDER_') ||
        normalizedTokenAddress.toLowerCase() === 'base';
      const tokenAccount = !isPlaceholderToken && normalizedTokenAddress.length > 0
        ? normalizedTokenAddress
        : undefined;
      
      const withdrawalAmount = toBaseUnits(amount, tokenDecimals);

      await Promise.resolve(
        sendFn.call(builder, destinationAccount, withdrawalAmount, tokenAccount),
      );

      const receipt = await userClient.publishBuilder(builder);
      return { blockHash: extractBlockHash(receipt) ?? null } satisfies RFQCancelResult;
    },
    [userClient, walletAddress],
  );

  const signAtomicSwapDeclaration = useCallback(
    async ({ unsignedBlockHex, unsignedBlockJson }: { unsignedBlockHex?: string | null; unsignedBlockJson?: unknown }) => {
      if (!userClient) {
        throw new Error('Keeta wallet client unavailable. Connect your wallet first.');
      }

      const builder = userClient.initBuilder?.();
      if (!builder) {
        throw new Error('Wallet client does not support initBuilder(). Update your Keeta Wallet.');
      }

      let blockBytes: Uint8Array | undefined;

      if (typeof unsignedBlockHex === 'string' && unsignedBlockHex.length > 0) {
        try {
          const cleaned = unsignedBlockHex.trim().toLowerCase().startsWith('0x')
            ? unsignedBlockHex.trim().slice(2)
            : unsignedBlockHex.trim();
          const matches = cleaned.match(/[0-9a-f]{2}/gi) ?? [];
          blockBytes = new Uint8Array(matches.map((pair) => parseInt(pair, 16)));
        } catch (error) {
          console.warn('[WalletContext] Failed to parse unsigned block hex', error);
        }
      }

      if (!blockBytes && unsignedBlockJson) {
        try {
          const text = typeof unsignedBlockJson === 'string' ? unsignedBlockJson : JSON.stringify(unsignedBlockJson);
          blockBytes = new TextEncoder().encode(text);
        } catch (error) {
          console.warn('[WalletContext] Failed to encode unsigned block JSON', error);
        }
      }

      if (!blockBytes) {
        throw new Error('No unsigned block payload available for signing.');
      }

      const loadFn = (builder as { loadUnsignedBlock?: (payload: Uint8Array) => unknown }).loadUnsignedBlock;
      if (typeof loadFn !== 'function') {
        throw new Error('Wallet builder missing loadUnsignedBlock(). Update Keeta Wallet.');
      }

      await Promise.resolve(loadFn.call(builder, blockBytes));

      const receipt = await userClient.publishBuilder?.(builder);
      const blockHash = extractBlockHash(receipt);
      let signedBlock: string | null = null;
      if (typeof receipt === 'string') {
        signedBlock = receipt;
      } else if (receipt) {
        try {
          signedBlock = JSON.stringify(receipt);
        } catch (error) {
          console.warn('[WalletContext] Failed to serialize publishBuilder receipt', error);
        }
      }

      return { published: true, blockHash: blockHash ?? null, signedBlock };
    },
    [userClient],
  );

  const grantStoragePermission = useCallback(
    async (storageAddress: string, operatorAddress: string, tokenAddress: string) => {
      if (!userClient) {
        throw new Error('Wallet client not initialized. Connect your wallet first.');
      }
      if (!storageAddress || !operatorAddress || !tokenAddress) {
        throw new Error('Storage address, operator address, and token address are required.');
      }

      const manager = new StorageAccountManager(userClient);
      await manager.grantTokenPermission(storageAddress, operatorAddress, tokenAddress);
    },
    [userClient],
  );

  const revokeStoragePermission = useCallback(
    async (storageAddress: string, operatorAddress: string) => {
      if (!userClient) {
        throw new Error('Wallet client not initialized. Connect your wallet first.');
      }
      if (!storageAddress || !operatorAddress) {
        throw new Error('Storage address and operator address are required.');
      }

      const manager = new StorageAccountManager(userClient);
      await manager.revokeOperatorPermissions(storageAddress, operatorAddress);
    },
    [userClient],
  );

  const withdrawFromStorage = useCallback(
    async (
      storageAddress: string,
      destinationAddress: string,
      tokenAddress: string,
      amount: string,
      decimals: number,
    ): Promise<string> => {
      if (!userClient) {
        throw new Error('Wallet client not initialized. Connect your wallet first.');
      }
      if (!storageAddress || !destinationAddress || !tokenAddress) {
        throw new Error('Storage address, destination address, and token address are required.');
      }
      const numericAmount = Number.parseFloat(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error('Withdrawal amount must be greater than zero.');
      }

      const amountInBaseUnits = toBaseUnits(numericAmount, decimals);
      const manager = new StorageAccountManager(userClient);
      return manager.selfWithdraw(
        storageAddress,
        destinationAddress,
        tokenAddress,
        amountInBaseUnits,
      );
    },
    [userClient],
  );

  const verifyStorageAccount = useCallback(
    async (storageAddress: string): Promise<StorageAccountState> => {
      if (!userClient) {
        throw new Error('Wallet client not initialized');
      }
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
          fieldType: 'decimals' as const, // Default to decimals field type
          normalizedAmount: fromBaseUnits(amount, decimals),
        };
      });

      console.log('[WalletContext] Storage state snapshot', {
        address: storageAddress,
        balanceCount: balances.length,
        tokens: balances.map((balance) => ({
          token: balance.token,
          decimals: balance.decimals,
          normalizedAmount: balance.normalizedAmount,
        })),
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const globalWindow = window as unknown as { __KEYTHINGS_DEVTOOLS__?: Record<string, unknown> };
    const devtools = (globalWindow.__KEYTHINGS_DEVTOOLS__ ??= {});
    const previousWalletScope = (devtools.wallet as Record<string, unknown> | undefined) ?? {};

    const maybeAccountState = userClient as unknown as {
      getAccountState?: (account: string) => Promise<unknown>;
    } | null;

    const getAccountStateFn = typeof maybeAccountState?.getAccountState === 'function'
      ? (account: string) => maybeAccountState!.getAccountState!(account)
      : null;

    devtools.wallet = {
      ...previousWalletScope,
      userClient: userClient ?? null,
      verifyStorageAccount,
      getAccountState: getAccountStateFn,
    } satisfies Record<string, unknown>;
  }, [userClient, verifyStorageAccount]);

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
      connectWallet: (requestCapabilities = false) => walletData.connectWallet(requestCapabilities),
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
      hasTransactionPermissions,
      requestTransactionPermissions,
      getTokenMetadata: async (tokenAddress: string) => {
        if (!userClient) return null;
        
        try {
          console.log('[WalletContext] getTokenMetadata called for:', tokenAddress);
          console.log('[WalletContext] userClient.baseToken:', userClient.baseToken);
          console.log('[WalletContext] baseTokenAddress:', primaryAccount);
          
          // Handle placeholder tokens - return null for placeholders
          if (tokenAddress.startsWith('PLACEHOLDER_') || tokenAddress === 'PLACEHOLDER_BASE') {
            console.log('[WalletContext] Placeholder token detected, returning null');
            return null;
          }
          
          // Handle base token specially
          if (tokenAddress === 'base' || 
              tokenAddress === (userClient.baseToken as any)?.publicKeyString ||
              tokenAddress === primaryAccount) {
            const baseTokenInfo = userClient.baseToken;
            if (baseTokenInfo && typeof baseTokenInfo === 'object' && 'info' in baseTokenInfo) {
              const info = (baseTokenInfo as any).info;
              const metadata = info?.metadata;
              
              if (metadata) {
                const { decimals, fieldType } = extractDecimalsAndFieldType(metadata);
                console.log('[WalletContext] Base token metadata found:', { decimals, fieldType });
                
                // Fix incorrect naming - ensure proper KTA naming
                let name = info.name || 'Keeta Token';
                let symbol = info.symbol || 'KTA';
                let ticker = info.ticker || 'KTA';
                
                // Correct common naming issues
                if (name.includes('BASE') && !name.includes('Keeta Token')) {
                  name = 'Keeta Token';
                }
                if (symbol.includes('BASE') && symbol !== 'KTA') {
                  symbol = 'KTA';
                }
                if (ticker.includes('BASE') && ticker !== 'KTA') {
                  ticker = 'KTA';
                }
                
                return {
                  decimals,
                  fieldType,
                  name,
                  symbol,
                  ticker,
                  metadata
                };
              }
            }
            
            // Fallback for base token when metadata is not available
            console.log('[WalletContext] Base token metadata not found, using fallback');
            return {
              decimals: 9, // Default KTA decimals
              fieldType: 'decimals' as const,
              name: 'Keeta Token',
              symbol: 'KTA',
              ticker: 'KTA',
              metadata: null
            };
          }

          // For regular tokens, try to get from account state
          console.log('[WalletContext] Trying to get account state for token:', tokenAddress);
          if ('getAccountState' in userClient && typeof userClient.getAccountState === 'function') {
            const accountState = await userClient.getAccountState(tokenAddress);
            console.log('[WalletContext] Account state result:', accountState);
            if (accountState?.info?.metadata) {
              const { decimals, fieldType } = extractDecimalsAndFieldType(accountState.info.metadata);
              console.log('[WalletContext] Token metadata found:', { decimals, fieldType });
              return {
                decimals,
                fieldType,
                name: accountState.info.name,
                symbol: accountState.info.symbol,
                ticker: accountState.info.ticker,
                metadata: accountState.info.metadata
              };
            }
          }

          console.log('[WalletContext] No metadata found for token:', tokenAddress);
          return null;
        } catch (error) {
          console.error('Failed to fetch token metadata:', error);
          return null;
        }
      },

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
      signAtomicSwapDeclaration,
      grantStoragePermission,
      revokeStoragePermission,
      withdrawFromStorage,
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
    requestTransactionPermissions,
    hasTransactionPermissions,
    userClient,
    // createRFQStorageAccount removed
    fillRFQOrder,
    cancelRFQOrder,
    verifyStorageAccount,
    getStorageAccountPermissions,
    signAtomicSwapDeclaration,
    grantStoragePermission,
    revokeStoragePermission,
    withdrawFromStorage,
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
