'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, Zap } from 'lucide-react';

import { useMakerProfiles, useRFQContext } from '@/app/contexts/RFQContext';
import type { RFQMakerMeta, RFQQuoteDraft, RFQQuoteSubmission } from '@/app/types/rfq';
import { useWallet } from '@/app/contexts/WalletContext';
import { useProcessedTokens } from '@/app/hooks/useProcessedTokens';
import { StorageAccountManager } from '@/app/lib/storage-account-manager';
import { createPermissionPayload } from '@/app/lib/storage-account-manager';
import { getMakerTokenSymbol, getTakerTokenAddress, getTakerTokenAddressFromOrder, getTakerTokenSymbol, toBaseUnits } from '@/app/lib/token-utils';
import { WizardProgress, type WizardProgressStep } from '../WizardProgress';

import { useTokenMetadata } from '@/app/hooks/useTokenMetadata';
import { encodeToBase64 } from '@/app/lib/encoding';

const EXPIRY_PRESETS: Array<{ value: RFQQuoteDraft['expiryPreset']; label: string }> = [
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: '24h', label: '24 hours' },
];

interface MakerDraftState {
  price: string;
  size: string;
  minFill: string;
  expiryPreset: RFQQuoteDraft['expiryPreset'];
  allowlistLabel: string;
  autoSignProfileId: string;
}

const DEFAULT_DRAFT: MakerDraftState = {
  price: '',
  size: '',
  minFill: '',
  expiryPreset: '1h',
  allowlistLabel: '',
  autoSignProfileId: 'default',
};

const STORAGE_KEY = 'rfq-maker-draft';

function trimPubkey(pubkey: string | null): string {
  if (!pubkey) {
    return 'unlinked';
  }
  return `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`;
}

function shorten(address: string | undefined | null, chars = 4): string {
  if (!address) {
    return 'unknown';
  }
  if (address.length <= chars * 2) {
    return address;
  }
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

// Token utility functions are now imported from @/app/lib/token-utils

type WizardStep = 'details' | 'review' | 'creating' | 'funding';

const RFQ_STEP_SEQUENCE: WizardStep[] = ['details', 'review', 'creating', 'funding'];

const RFQ_WIZARD_STEPS: WizardProgressStep<WizardStep>[] = [
  {
    id: 'details',
    title: '',
  },
  {
    id: 'review',
    title: '',
  },
  {
    id: 'creating',
    title: '',
  },
  {
    id: 'funding',
    title: '',
  },
];

function isValidKeetaAddress(value: string | null | undefined): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length < 10) {
    return false;
  }
  if (trimmed.toLowerCase().startsWith('placeholder')) {
    return false;
  }
  return /^[a-z0-9_:-]+$/i.test(trimmed);
}

interface RFQMakerPanelProps {
  mode: 'rfq_taker' | 'rfq_maker' | 'rfq_orders';
  onModeChange: (mode: 'rfq_taker' | 'rfq_maker' | 'rfq_orders') => void;
  hideInternalTabs?: boolean;
}

export function RFQMakerPanel({ mode, onModeChange, hideInternalTabs }: RFQMakerPanelProps): React.JSX.Element {
  const { tokenA, tokenB, pair, createQuote, cancelQuote, selectedOrder } = useRFQContext();
  const makerProfiles = useMakerProfiles();
  const { publicKey, isConnected, userClient, getTokenMetadata } = useWallet();
  const { tokens, isLoading: isLoadingTokens, error: tokensError, refreshTokens } = useProcessedTokens();

  const [draft, setDraft] = useState<MakerDraftState>(DEFAULT_DRAFT);
  const [showAllTokens, setShowAllTokens] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  // Multi-step wizard (aligned with CreatePoolModal pattern)
  const [step, setStep] = useState<WizardStep>('details');
  const [storageAccountAddress, setStorageAccountAddress] = useState<string | null>(null);
  const [currentSubmission, setCurrentSubmission] = useState<RFQQuoteSubmission | null>(null);
  const [isAwaitingManualAddress, setIsAwaitingManualAddress] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualAddressError, setManualAddressError] = useState<string | null>(null);

  const [baseSymbol, quoteSymbol] = useMemo(() => {
    if (tokenA?.symbol && tokenB?.symbol) {
      return [tokenA.symbol, tokenB.symbol];
    }
    const [base = '', quote = ''] = pair.split('/').map((symbol) => symbol.trim());
    return [base, quote];
  }, [pair, tokenA?.symbol, tokenB?.symbol]);

  const completedSteps = useMemo(() => {
    const index = RFQ_STEP_SEQUENCE.indexOf(step);
    if (index <= 0) {
      return [] as WizardStep[];
    }
    return RFQ_STEP_SEQUENCE.slice(0, index) as WizardStep[];
  }, [step]);

  // Token selection state
  const [selectedToken, setSelectedToken] = useState<string | null>(null);

  // Get available tokens from processed tokens (same as Dashboard)
  const availableTokens = useMemo(() => {
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return [];
    }

    const normalizedBase = baseSymbol?.trim().toUpperCase() ?? '';
    const normalizedQuote = quoteSymbol?.trim().toUpperCase() ?? '';
    const relevantSymbols = new Set(
      [normalizedBase, normalizedQuote]
        .map((symbol) => symbol.trim())
        .filter((symbol) => symbol.length > 0),
    );

    return tokens
      .filter((token) => {
        const balance = Number.parseFloat(token.balance);
        if (!Number.isFinite(balance) || balance <= 0) {
          return false;
        }

        if (showAllTokens || relevantSymbols.size === 0) {
          return true;
        }

        const symbol = token.ticker?.toUpperCase();
        if (!symbol) {
          return false;
        }

        return relevantSymbols.size === 0 || relevantSymbols.has(symbol);
      })
      .map((token) => ({
        address: token.address,
        symbol: token.ticker,
        balance: token.formattedAmount,
        decimals: token.decimals,
        name: token.name,
      }))
      .sort((a, b) => {
        const balanceA = Number.parseFloat(tokens.find((entry) => entry.address === a.address)?.balance ?? '0');
        const balanceB = Number.parseFloat(tokens.find((entry) => entry.address === b.address)?.balance ?? '0');
        return balanceB - balanceA;
      });
  }, [tokens, baseSymbol, quoteSymbol, showAllTokens]);

  const selectedTokenInfo = useMemo(() => {
    if (!selectedToken) {
      return null;
    }
    return availableTokens.find((token) => token.address === selectedToken) ?? null;
  }, [availableTokens, selectedToken]);

  const selectedTokenMeta = useMemo(() => {
    if (!selectedToken) {
      return null;
    }
    return tokens.find((token) => token.address === selectedToken) ?? null;
  }, [tokens, selectedToken]);

  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const tokenDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (!tokenDropdownRef.current || !(event.target instanceof Node)) {
        return;
      }
      if (!tokenDropdownRef.current.contains(event.target)) {
        setIsTokenDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickAway);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, []);

  const makerSymbolDisplay = useMemo(() => {
    if (selectedOrder) {
      return getMakerTokenSymbol(selectedOrder.pair, selectedOrder.side) || baseSymbol || 'Token';
    }
    return baseSymbol || 'Token';
  }, [selectedOrder, baseSymbol]);

  // Auto-select first token when available and reset invalid selections
  useEffect(() => {
    if (availableTokens.length === 0) {
      if (selectedToken) {
        setSelectedToken(null);
      }
      return;
    }

    const stillValid = selectedToken && availableTokens.some((token) => token.address === selectedToken);
    if (!stillValid) {
      setSelectedToken(availableTokens[0].address);
    }
  }, [availableTokens, selectedToken]);

  // Debug token balances loading
  useEffect(() => {
    console.log('[RFQMakerPanel] Token balances debug:', {
      isConnected,
      isLoadingTokens,
      tokensError,
      tokensCount: Array.isArray(tokens) ? tokens.length : 'not array',
      tokens: tokens
    });
  }, [isConnected, isLoadingTokens, tokensError, tokens]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as MakerDraftState;
        setDraft({ ...DEFAULT_DRAFT, ...parsed });
      } catch (storageError) {
        console.warn('Failed to parse RFQ maker draft from storage', storageError);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    setSuccess(null);
    setError(null);
    setProgressMessage(null);
    setStep('details');
    setCurrentSubmission(null);
  }, [pair]);

  const makerProfile = useMemo(() => {
    const networkProfile = publicKey ? makerProfiles.find((maker) => maker.id === publicKey) : undefined;

    if (networkProfile) {
      return {
        id: networkProfile.id,
        displayName: networkProfile.displayName,
        verified: networkProfile.verified,
        reputationScore: networkProfile.reputationScore,
        fillsCompleted: networkProfile.fillsCompleted,
        failureRate: networkProfile.failureRate,
        allowlistLabel: networkProfile.allowlistLabel || undefined,
      };
    }

    return {
      id: publicKey || '',
      displayName: `Maker ${trimPubkey(publicKey)}`,
      verified: false,
      reputationScore: 0,
      fillsCompleted: 0,
      failureRate: 0,
      allowlistLabel: undefined,
    };
  }, [makerProfiles, publicKey]);

  const selectedMakerOrder = useMemo(() => {
    if (!selectedOrder || !publicKey) {
      return undefined;
    }
    return selectedOrder.maker.id === publicKey ? selectedOrder : undefined;
  }, [selectedOrder, publicKey]);

  const makerDraftSymbol = useMemo(() => baseSymbol || 'base', [baseSymbol]);

  const takerDraftSymbol = useMemo(() => quoteSymbol || 'quote', [quoteSymbol]);

  const reviewSubmission = useMemo<RFQQuoteSubmission | null>(() => {
    if (step !== 'review') {
      return null;
    }

    if (currentSubmission) {
      return currentSubmission;
    }

    return {
      pair,
      side: 'sell',
      price: draft.price,
      size: draft.size,
      minFill: draft.minFill || undefined,
      expiryPreset: draft.expiryPreset,
      allowlistLabel: draft.allowlistLabel || undefined,
      autoSignProfileId: draft.autoSignProfileId || undefined,
      maker: makerProfile,
    };
  }, [currentSubmission, draft.allowlistLabel, draft.autoSignProfileId, draft.expiryPreset, draft.price, draft.size, draft.minFill, makerProfile, pair, step]);

  const handleCopyOrderId = useCallback(() => {
    if (selectedMakerOrder) {
      navigator.clipboard.writeText(selectedMakerOrder.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  }, [selectedMakerOrder]);

  // Step 1: Create Storage Account (following CreatePoolModal pattern)
  const validateDetailsStep = useCallback((): boolean => {
    if (!draft.price || Number.isNaN(Number.parseFloat(draft.price))) {
      setError('Enter a valid price.');
      return false;
    }

    if (!draft.size || Number.isNaN(Number.parseFloat(draft.size))) {
      setError('Enter a valid size.');
      return false;
    }

    setError(null);
    return true;
  }, [draft.price, draft.size]);

  const validateControlsStep = useCallback((): boolean => {
    if (draft.minFill && Number.isNaN(Number.parseFloat(draft.minFill))) {
      setError('Min fill must be numeric.');
      return false;
    }

    setError(null);
    return true;
  }, [draft.minFill]);

  const goToPreviousStep = useCallback(() => {
    if (step === 'review') {
      setCurrentSubmission(null);
      setStep('details');
      return;
    }
    if (step === 'creating') {
      setStep('review');
    }
  }, [setCurrentSubmission, step]);

  // Step 4: Fund Quote (following CreatePoolModal pattern)
  const handleFundStorage = useCallback(async () => {
    console.log('[RFQMakerPanel] handleFundStorage called');
    console.log('[RFQMakerPanel] storageAccountAddress:', storageAccountAddress);
    console.log('[RFQMakerPanel] currentSubmission:', currentSubmission);

    if (!userClient || !publicKey) {
      setError('Connect your wallet before funding the RFQ order.');
      return;
    }

    if (!storageAccountAddress || !storageAccountAddress.startsWith('keeta_')) {
      console.log('[RFQMakerPanel] Storage account validation failed - redirecting to review step');
      setError('Storage account not created. Please click "Fund Quote" first to create the storage account.');
      setStep('review');
      return;
    }

    console.log('[RFQMakerPanel] Storage account validation passed:', storageAccountAddress);

    if (!currentSubmission) {
      setError('Missing order submission data. Please try creating the order again.');
      return;
    }

    if (!makerProfile) {
      setError('Maker profile not found. Please check your wallet connection.');
      return;
    }

    setIsPublishing(true);
    setError(null);
    setProgressMessage('Setting RFQ order metadata...');
    try {
      console.log('[RFQMakerPanel] Step 2/2: Setting RFQ order metadata...');
      console.log('[RFQMakerPanel] Storage account:', storageAccountAddress);
      console.log('[RFQMakerPanel] Current submission:', JSON.stringify(currentSubmission));

      // Type guard: Ensure currentSubmission is not null (already validated above)
      if (!currentSubmission) {
        throw new Error('Current submission is null. This should not happen.');
      }

      // Build transaction to set RFQ order metadata
      console.log('[RFQMakerPanel] Building RFQ metadata transaction...');

      const builder = userClient.initBuilder();
      if (!builder) {
        throw new Error('Failed to initialize transaction builder');
      }

      if (typeof builder.setInfo !== 'function') {
        throw new Error('Builder does not support setInfo operations');
      }

      // Validate storage account address
      if (!storageAccountAddress || storageAccountAddress === '_PLACEHOLDER_') {
        throw new Error('Invalid storage account address. Please create the storage account first.');
      }

      // Create serializable object for the storage account (following CreatePoolModal pattern)
      const toAccount = JSON.parse(JSON.stringify({ publicKeyString: storageAccountAddress }));

      console.log('[RFQMakerPanel] toAccount:', JSON.stringify(toAccount));

      // Fund the storage account with the maker's tokens
      console.log('[RFQMakerPanel] Funding storage account with maker tokens...');

      // Get selected token information
      if (!selectedToken) {
        throw new Error('Please select a token to trade');
      }

      const selectedTokenInfo = availableTokens.find(t => t.address === selectedToken);
      if (!selectedTokenInfo) {
        throw new Error('Selected token not found in available tokens');
      }

      // For RFQ, the maker provides the selected token, taker provides the opposite side of the pair
      const makerTokenAddress = selectedTokenInfo.address;
      const makerTokenDecimals = selectedTokenInfo.decimals;
      const makerAmount = toBaseUnits(parseFloat(currentSubmission.size), makerTokenDecimals).toString();

      // Determine the taker token address from pair + side, falling back to base-token reference
      const baseTokenAddressCandidate = (userClient?.baseToken as { publicKeyString?: string } | undefined)?.publicKeyString;
      const baseTokenAddress = typeof baseTokenAddressCandidate === 'string' ? baseTokenAddressCandidate : null;
      const derivedTakerTokenAddress = getTakerTokenAddress(currentSubmission.pair, currentSubmission.side);
      const takerTokenAddress = baseTokenAddress ?? derivedTakerTokenAddress;

      if (!takerTokenAddress || takerTokenAddress.toUpperCase().startsWith('PLACEHOLDER')) {
        const takerSymbolFallback = getTakerTokenSymbol(currentSubmission.pair, currentSubmission.side) || 'taker token';
        throw new Error(`Unable to determine ${takerSymbolFallback} token address. Refresh your wallet balances and try again.`);
      }

      // Fetch taker token metadata from wallet provider
      const makerTokenSymbol = selectedTokenInfo.symbol;
      const takerTokenMetadata = await getTokenMetadata(baseTokenAddress ?? takerTokenAddress).catch(() => null);
      const takerTokenDecimals = takerTokenMetadata?.decimals ?? 9;
      const takerAmount = toBaseUnits(
        parseFloat(currentSubmission.size) * parseFloat(currentSubmission.price),
        takerTokenDecimals,
      ).toString();
      const takerTokenSymbol = takerTokenMetadata?.symbol
        ?? takerTokenMetadata?.ticker
        ?? takerTokenMetadata?.name
        ?? getTakerTokenSymbol(currentSubmission.pair, currentSubmission.side)
        ?? shorten(takerTokenAddress);

      const normalizedPair = `${makerTokenSymbol}/${takerTokenSymbol}`;
      const nextSubmission: RFQQuoteSubmission = {
        ...currentSubmission,
        pair: normalizedPair,
      };
      setCurrentSubmission(nextSubmission);

      // Set metadata with RFQ order details and atomic swap terms
      const metadataJson = JSON.stringify({
        // Existing fields
        pair: normalizedPair,
        side: nextSubmission.side,
        price: nextSubmission.price,
        size: nextSubmission.size,
        minFill: nextSubmission.minFill,
        expiry: new Date(Date.now() + getExpiryMs(nextSubmission.expiryPreset)).toISOString(),
        makerAddress: publicKey,
        allowlistLabel: nextSubmission.allowlistLabel,
        autoSignProfileId: nextSubmission.autoSignProfileId,

        // NEW: Atomic swap constraints
        atomicSwap: {
          makerToken: makerTokenAddress,      // Token maker is offering
          makerAmount: makerAmount.toString(), // Amount maker deposited
          makerSymbol: makerTokenSymbol,
          makerDecimals: makerTokenDecimals,
          takerToken: takerTokenAddress,       // Token taker must send
          takerAmount: takerAmount.toString(), // Amount taker must send
          takerSymbol: takerTokenSymbol,
          takerDecimals: takerTokenDecimals,
          swapRate: nextSubmission.price,      // Exchange rate
          recipient: publicKey,                // Where taker must send tokens
        },
      });

      // Encode metadata as base64 (required by Keeta SDK)
      const metadataBase64 = encodeToBase64(metadataJson);

      // Set storage account info with metadata and permissions
      // According to Keeta docs, defaultPermission grants public access
      builder.setInfo({
        name: `RFQ_STORAGE_ACCOUNT`,
        description: `${nextSubmission.side} ${nextSubmission.size} ${nextSubmission.pair} @ ${nextSubmission.price}`,
        metadata: metadataBase64,
        // Grant storage permissions (no public SEND_ON_BEHALF in declaration-based flow)
        // STORAGE_DEPOSIT: anyone can deposit tokens
        // STORAGE_CAN_HOLD: storage can hold tokens
        // SEND_ON_BEHALF: will be granted per-taker after declaration approval
        defaultPermission: createPermissionPayload(['STORAGE_DEPOSIT', 'STORAGE_CAN_HOLD']),
      }, { account: toAccount });

      console.log('[RFQMakerPanel] ✅ Storage account configured with storage permissions (SEND_ON_BEHALF will be granted per-taker)');

      console.log('[RFQMakerPanel] Depositing', currentSubmission.size, 'tokens to storage account');
      console.log('[RFQMakerPanel] Token address:', makerTokenAddress);
      console.log('[RFQMakerPanel] Amount in base units:', makerAmount);

      // Create serializable token object
      const makerTokenRef = JSON.parse(JSON.stringify({ publicKeyString: makerTokenAddress }));

      // Add send operation to deposit tokens to storage account
      if (typeof builder.send !== 'function') {
        throw new Error('Builder does not support send operations');
      }

      builder.send(toAccount, makerAmount, makerTokenRef);
      console.log('[RFQMakerPanel] ✅ Token deposit operation added to builder');
      console.log('[RFQMakerPanel] ✅ Storage account configured with public withdrawal permissions for atomic swaps');

      // Compute blocks before publishing (required by Keeta SDK for send operations)
      console.log('[RFQMakerPanel] Computing transaction blocks...');
      if (typeof (builder as any).computeBlocks === 'function') {
        await (builder as any).computeBlocks();
        console.log('[RFQMakerPanel] ✅ Blocks computed');
      }

      console.log('[RFQMakerPanel] ⚠️ Please approve the RFQ funding transaction in your wallet extension!');
      console.warn('🔐 SECURITY: Wallet approval required for RFQ funding');
      console.warn(`🔐 You are about to deposit ${currentSubmission.size} tokens to the RFQ order`);
      console.warn('🔐 Please review and approve the transaction in your Keeta Wallet extension');

      // SECURITY: This publishBuilder call MUST trigger wallet approval
      // User must explicitly approve the RFQ funding transaction
      const fundingResult = await userClient.publishBuilder(builder);
      console.log('[RFQMakerPanel] ✅ RFQ funding transaction signed and funded');
      console.log('[RFQMakerPanel] Transaction result:', fundingResult);

      // Wait for Keeta settlement (400ms)
      console.log('[RFQMakerPanel] Waiting for Keeta settlement (400ms)...');
      await new Promise(resolve => setTimeout(resolve, 600));

      // Create the order with the real storage account address
      console.log('[RFQMakerPanel] Creating order with real storage account address...');
      console.log('[RFQMakerPanel] storageAccountAddress:', storageAccountAddress);
      console.log('[RFQMakerPanel] storageAccountAddress type:', typeof storageAccountAddress);

      if (!storageAccountAddress || !storageAccountAddress.startsWith('keeta_')) {
        throw new Error(`Invalid storage account address: ${storageAccountAddress}`);
      }

      // Create the order with the storage account address
      const order = await createQuote(nextSubmission, storageAccountAddress);
      setSuccess(
        `Quote ${order.id} funded with escrow ${shorten(storageAccountAddress)}.`,
      );
      setProgressMessage(null); // Clear progress message since process is complete
      setStep('details');

      // Reset state
      setStorageAccountAddress(null);
      setCurrentSubmission(null);

    } catch (err) {
      console.error('[RFQMakerPanel] Error funding storage account:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fund RFQ order. Please try again.';
      setError(errorMessage);
      setStep('details');
      setProgressMessage(null);
    } finally {
      setIsPublishing(false);
    }
  }, [userClient, publicKey, storageAccountAddress, currentSubmission, createQuote, makerProfile, availableTokens, selectedToken, getTokenMetadata]);

  const handleCreateStorage = useCallback(async () => {
    if (!isConnected || !publicKey || !userClient) {
      setError('Connect your market maker wallet before publishing quotes.');
      return;
    }

    if (!makerProfile) {
      setError('Maker profile not found. Please check your wallet connection.');
      return;
    }

    if (!validateDetailsStep() || !validateControlsStep()) {
      return;
    }

    const submission: RFQQuoteSubmission = {
      pair,
      side: 'sell',
      price: draft.price,
      size: draft.size,
      minFill: draft.minFill || undefined,
      expiryPreset: draft.expiryPreset,
      allowlistLabel: draft.allowlistLabel || undefined,
      autoSignProfileId: draft.autoSignProfileId || undefined,
      maker: makerProfile,
    };

    setCurrentSubmission(submission);
    setIsPublishing(true);
    setError(null);
    setSuccess(null);
    setStep('creating');
    setProgressMessage('Creating storage account for your RFQ order...');
    setIsAwaitingManualAddress(false);
    setManualAddress('');
    setManualAddressError(null);

    try {
      const operatorCandidateRaw = (process.env.NEXT_PUBLIC_EXCHANGE_OPERATOR_PUBKEY ?? '').trim();
      const operatorAccount = isValidKeetaAddress(operatorCandidateRaw) ? operatorCandidateRaw : null;

      const tokenInfo = selectedToken
        ? availableTokens.find((token) => token.address === selectedToken)
        : undefined;
      if (!tokenInfo) {
        throw new Error('Select a funding token before creating an RFQ storage account.');
      }

      const takerTokenCandidate = getTakerTokenAddress(submission.pair, submission.side);

      const baseTokenCandidate =
        (userClient.baseToken as { publicKeyString?: string } | undefined)?.publicKeyString;
      const envAllowedTokens = (process.env.NEXT_PUBLIC_RFQ_ALLOWED_TOKENS ?? '')
        .split(',')
        .map((token) => token.trim())
        .filter(isValidKeetaAddress);

      const primaryTokens = [tokenInfo.address, takerTokenCandidate, baseTokenCandidate];
      const allowedTokens = Array.from(
        new Set([...primaryTokens, ...envAllowedTokens].filter(isValidKeetaAddress)),
      );

      if (allowedTokens.length === 0 && isValidKeetaAddress(tokenInfo.address)) {
        allowedTokens.push(tokenInfo.address);
      }

      if (allowedTokens.length === 0) {
        throw new Error('Unable to determine allowed tokens for RFQ escrow. Verify token addresses for the selected pair.');
      }

      const manager = new StorageAccountManager(userClient);

      let rfqStorageAddress: string;
      try {
        const createPromise = manager.createStorageAccount(operatorAccount, allowedTokens);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), 30000),
        );

        rfqStorageAddress = await Promise.race([createPromise, timeoutPromise]);
        if (!isValidKeetaAddress(rfqStorageAddress)) {
          throw new Error(`Invalid storage account address received: ${rfqStorageAddress}`);
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'TIMEOUT') {
          setIsAwaitingManualAddress(true);
          setManualAddress('');
          setManualAddressError(null);
          setProgressMessage('Wallet confirmation timed out. Paste the storage account address from your Keeta wallet to continue.');
          return;
        }
        throw error;
      }

      setIsAwaitingManualAddress(false);
      setManualAddress('');
      setManualAddressError(null);
      setStorageAccountAddress(rfqStorageAddress);

      await new Promise((resolve) => setTimeout(resolve, 500));
      setStep('funding');
      setProgressMessage('Storage account created! Click "Publish Quote" to complete the RFQ setup.');

    } catch (err) {
      console.error('[RFQMakerPanel] Error creating storage account:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create storage account. Please try again.';
      setError(errorMessage);
      setStep('details');
      setProgressMessage(null);
      setIsAwaitingManualAddress(false);
    } finally {
      setIsPublishing(false);
    }
  }, [draft, isConnected, makerProfile, pair, publicKey, userClient, validateControlsStep, validateDetailsStep, availableTokens, selectedToken]);

  const handleManualAddressSubmit = useCallback(() => {
    if (!isAwaitingManualAddress) {
      return;
    }

    const trimmed = manualAddress.trim();
    if (!isValidKeetaAddress(trimmed)) {
      setManualAddressError('Enter a valid Keeta storage account address.');
      return;
    }

    setStorageAccountAddress(trimmed);
    setIsAwaitingManualAddress(false);
    setManualAddressError(null);
    setProgressMessage('Storage account confirmed. Click "Publish Quote" to complete funding.');
    setStep('funding');
  }, [isAwaitingManualAddress, manualAddress]);

  const handleManualAddressCancel = useCallback(() => {
    setIsAwaitingManualAddress(false);
    setManualAddress('');
    setManualAddressError(null);
    setProgressMessage(null);
    setIsPublishing(false);
  }, []);

  // Helper function for expiry calculation
  function getExpiryMs(preset: '5m' | '15m' | '1h' | '4h' | '24h'): number {
    const msPerMinute = 60 * 1000;
    switch (preset) {
      case '5m': return 5 * msPerMinute;
      case '15m': return 15 * msPerMinute;
      case '1h': return 60 * msPerMinute;
      case '4h': return 4 * 60 * msPerMinute;
      case '24h': return 24 * 60 * msPerMinute;
      default: return 60 * msPerMinute; // Default to 1 hour
    }
  }

  const handleCancelSelected = useCallback(async () => {
    if (!selectedMakerOrder) {
      return;
    }
    await cancelQuote(selectedMakerOrder.id);
  }, [cancelQuote, selectedMakerOrder]);

  const content = (
    <>
      {!hideInternalTabs && (
        <div className="flex items-center justify-between gap-1 rounded-full bg-surface-strong px-2 py-1 text-xs">
          <button
            type="button"
            onClick={() => onModeChange('rfq_taker')}
            className={`flex-1 rounded-full px-3 py-1 font-medium transition-colors ${
              mode === 'rfq_taker' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
            }`}
          >
            RFQ Taker
          </button>
          <button
            type="button"
            onClick={() => onModeChange('rfq_maker')}
            className={`flex-1 rounded-full px-3 py-1 font-medium transition-colors ${
              mode === 'rfq_maker' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
            }`}
          >
            RFQ Maker
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Publish an order and fund it.</p>
      </div>
      <WizardProgress
        steps={RFQ_WIZARD_STEPS}
        currentStep={step === 'creating' ? 'creating' : step}
        completedSteps={completedSteps}
      />

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-hairline bg-surface-strong p-4">
          <AlertTriangle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {success && (
        <div className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/10 p-4">
          <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-accent">{success}</p>
          </div>
        </div>
      )}

      {/* Progress Message */}
      {progressMessage && (
        <div className="p-4 rounded-lg bg-accent/10 border border-accent/30 flex items-start gap-3">
          <Loader2 className="h-5 w-5 text-accent animate-spin" />
          <div className="flex-1">
            <p className="text-sm text-accent">{progressMessage}</p>
          </div>
        </div>
      )}

      {isAwaitingManualAddress && (
        <div className="space-y-3 rounded-lg border border-hairline bg-surface p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Confirm storage account</p>
            <p className="text-xs text-muted">
              Paste the storage account address shown in your Keeta wallet to continue funding this RFQ.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={manualAddress}
              onChange={(event) => {
                setManualAddress(event.target.value);
                setManualAddressError(null);
              }}
              placeholder="keeta_..."
              className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleManualAddressSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
              >
                Use Address
              </button>
              <button
                type="button"
                onClick={handleManualAddressCancel}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-hairline bg-surface px-4 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-strong transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
          {manualAddressError && (
            <p className="text-xs text-accent">{manualAddressError}</p>
          )}
        </div>
      )}

      {/* Step 1: Quote Details */}
      {step === 'details' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-hairline bg-surface-strong p-4">
            <div className="mb-3 flex items-center justify-between text-xs text-muted">
              <span>Trading Pair</span>
              <span className="text-foreground font-medium">{pair}</span>
            </div>

            {/* Token Selector */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-muted">Select Token to Trade</label>
                {!isLoadingTokens && (
                  <button
                    type="button"
                    onClick={() => refreshTokens()}
                    className="text-xs text-accent hover:text-accent/80 transition-colors"
                  >
                    Refresh
                  </button>
                )}
              </div>
              {isLoadingTokens ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your tokens...
                </div>
              ) : tokensError ? (
                <div className="space-y-2">
                  <div className="text-sm text-accent">
                    Error loading tokens: {tokensError}
                  </div>
                  <button
                    type="button"
                    onClick={() => refreshTokens()}
                    className="text-xs text-accent hover:text-accent/80 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              ) : availableTokens.length === 0 ? (
                <div className="space-y-2">
                  <div className="text-sm text-muted">
                    No eligible tokens found. Fund your wallet with the quote asset to create a maker RFQ.
                  </div>
                  <button
                    type="button"
                    onClick={() => refreshTokens()}
                    className="text-xs text-accent hover:text-accent/80 transition-colors"
                  >
                    Refresh tokens
                  </button>
                </div>
              ) : (
                <div ref={tokenDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsTokenDropdownOpen((previous) => !previous)}
                    className="flex w-full items-center justify-between rounded-lg border border-hairline bg-[#1a1c22] px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-accent/60 focus:border-accent focus:outline-none"
                  >
                    {selectedTokenInfo ? (
                      <span className="truncate">
                        {selectedTokenInfo.symbol} · {selectedTokenInfo.balance}
                      </span>
                    ) : (
                      <span className="text-muted">Select a funding token</span>
                    )}
                    <ChevronDown className={`h-4 w-4 transition-transform ${isTokenDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isTokenDropdownOpen && (
                    <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-hairline bg-[#1f2127] shadow-lg">
                      <div className="max-h-60 overflow-y-auto py-1">
                        {availableTokens.map((token) => {
                          const fullToken = tokens.find((entry) => entry.address === token.address);
                          const isActive = token.address === selectedToken;
                          return (
                            <button
                              key={token.address}
                              type="button"
                              onClick={() => {
                                setSelectedToken(token.address);
                                setIsTokenDropdownOpen(false);
                              }}
                              className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                                isActive
                                  ? 'bg-[#272a33] text-foreground'
                                  : 'bg-[#1f2127] text-muted hover:bg-[#272a33] hover:text-foreground'
                              }`}
                            >
                              {token.symbol} · {token.balance}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Size</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={draft.size}
                    onChange={(e) => setDraft(prev => ({ ...prev, size: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-muted">
                    Size is entered in {baseSymbol || 'base token'} units.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Price</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={draft.price}
                    onChange={(e) => setDraft(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-muted">
                    Price is quoted in {quoteSymbol || 'quote token'} per unit.
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Expires In</label>
                <div className="relative">
                  <select
                    value={draft.expiryPreset}
                    onChange={(event) =>
                      setDraft((previous) => ({ ...previous, expiryPreset: event.target.value as RFQQuoteDraft['expiryPreset'] }))
                    }
                    className="w-full rounded-lg border border-hairline bg-[#1a1c22] px-3 py-2 pr-8 text-sm text-foreground focus:border-accent focus:outline-none appearance-none cursor-pointer"
                    aria-label="Select expiration"
                  >
                    {EXPIRY_PRESETS.map((option) => (
                      <option key={option.value} value={option.value} style={{ backgroundColor: '#1f2127', color: 'var(--foreground)' }}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {/* Custom dropdown arrow */}
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="h-4 w-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Step 3: Review */}
      {step === 'review' && reviewSubmission && (
        <div className="space-y-4">
          <div className="rounded-lg border border-hairline bg-surface-strong p-4">
            <h4 className="mb-4 text-sm font-semibold text-foreground">Review Quote Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Side</span>
                  <span className="font-medium text-foreground">{reviewSubmission.side.toUpperCase()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Size</span>
                  <span className="font-medium text-foreground">{reviewSubmission.size}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Price</span>
                  <span className="font-medium text-foreground">{reviewSubmission.price}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Expiry</span>
                  <span className="font-medium text-foreground">{EXPIRY_PRESETS.find((p) => p.value === reviewSubmission.expiryPreset)?.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Min Fill</span>
                  <span className="font-medium text-foreground">{reviewSubmission.minFill ?? 'No minimum'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Allowlist</span>
                  <span className="font-medium text-foreground">{reviewSubmission.allowlistLabel ?? 'Public'}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs text-muted">
              When you continue, the wallet will create a Keeta storage account and sign the RFQ metadata on-chain.
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Create Storage Account */}
      {step === 'creating' && (
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 border border-accent/30 mb-4">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Creating Storage Account</h3>
          <p className="text-sm text-muted mb-6">
            Please approve the transaction in your wallet to create the storage account for your RFQ order.
          </p>
        </div>
      )}

      {/* Step 4: Publish Quote */}
      {step === 'funding' && (
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 border border-accent/30 mb-4">
            <CheckCircle2 className="w-8 h-8 text-accent" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Storage Account Created!</h3>
          <p className="text-sm text-muted mb-6">
            Now depositing your tokens to fund the RFQ order. Please approve the transaction in your wallet.
          </p>
          {currentSubmission && (
            <div className="p-4 rounded-lg bg-surface border border-hairline">
              <h4 className="text-sm font-semibold text-foreground mb-4">Order Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Side:</span>
                  <span className="text-foreground">{currentSubmission.side}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Size:</span>
                  <span className="text-foreground">{currentSubmission.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Price:</span>
                  <span className="text-foreground">{currentSubmission.price}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        {['details', 'review'].includes(step) && (
          <div className="flex gap-3">
            {step !== 'details' && (
              <button
                type="button"
                onClick={goToPreviousStep}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-hairline bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-strong"
              >
                Back
              </button>
            )}
            {step === 'details' && (
              <button
                type="button"
                onClick={() => {
                  if (validateDetailsStep()) {
                    setCurrentSubmission(null);
                    setStep('review');
                  }
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors ${
                  isConnected ? 'bg-accent hover:bg-accent/90' : 'bg-muted'
                }`}
                disabled={!isConnected}
              >
                Continue
              </button>
            )}
            {step === 'review' && (
              <button
                type="button"
                onClick={handleCreateStorage}
                disabled={!isConnected || isPublishing}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isConnected ? 'bg-accent hover:bg-accent/90' : 'bg-muted'
                }`}
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Fund Quote
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {step === 'funding' && (
          <button
            type="button"
            onClick={handleFundStorage}
            disabled={isPublishing}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white bg-accent hover:bg-accent/90 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPublishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Publish Quote
              </>
            )}
          </button>
        )}
      </div>

    </>
  );

  if (hideInternalTabs) {
    return (
      <div className="flex h-full flex-col gap-4">
        {content}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded-lg border border-hairline bg-surface p-4">
      {content}
    </div>
  );
}
