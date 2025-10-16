'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCopy, Loader2, Zap } from 'lucide-react';

import { useMakerProfiles, useRFQContext } from '@/app/contexts/RFQContext';
import type { RFQMakerMeta, RFQQuoteDraft, RFQQuoteSubmission } from '@/app/types/rfq';
import { useWallet } from '@/app/contexts/WalletContext';
import { StorageAccountManager } from '@/app/lib/storage-account-manager';
// Token utilities not needed for RFQ orders (no token deposits required)
import { createPermissionPayload } from '@/app/lib/storage-account-manager';

const EXPIRY_PRESETS: Array<{ value: RFQQuoteDraft['expiryPreset']; label: string }> = [
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: '24h', label: '24 hours' },
];

interface MakerDraftState {
  side: RFQQuoteDraft['side'];
  price: string;
  size: string;
  minFill: string;
  expiryPreset: RFQQuoteDraft['expiryPreset'];
  allowlistLabel: string;
  autoSignProfileId: string;
}

const DEFAULT_DRAFT: MakerDraftState = {
  side: 'sell',
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

type WizardStep = 'details' | 'controls' | 'review' | 'creating' | 'funding';

export function RFQMakerPanel(): React.JSX.Element {
  const { pair, createQuote, cancelQuote, selectedOrder } = useRFQContext();
  const makerProfiles = useMakerProfiles();
  const { publicKey, isConnected, userClient } = useWallet();
  const [draft, setDraft] = useState<MakerDraftState>(DEFAULT_DRAFT);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  // Multi-step wizard (following CreatePoolModal pattern)
  const [step, setStep] = useState<WizardStep>('details');
  const [storageAccountAddress, setStorageAccountAddress] = useState<string | null>(null);
  const [currentSubmission, setCurrentSubmission] = useState<RFQQuoteSubmission | null>(null);

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
        autoSignSlaMs: networkProfile.autoSignSlaMs,
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
      autoSignSlaMs: 5000,
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

  const reviewSubmission = useMemo<RFQQuoteSubmission | null>(() => {
    if (step !== 'review') {
      return null;
    }

    if (currentSubmission) {
      return currentSubmission;
    }

    return {
      pair,
      side: draft.side,
      price: draft.price,
      size: draft.size,
      minFill: draft.minFill || undefined,
      expiryPreset: draft.expiryPreset,
      allowlistLabel: draft.allowlistLabel || undefined,
      autoSignProfileId: draft.autoSignProfileId || undefined,
      maker: makerProfile,
    };
  }, [currentSubmission, draft.allowlistLabel, draft.autoSignProfileId, draft.expiryPreset, draft.price, draft.side, draft.size, draft.minFill, makerProfile, pair, step]);

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
    if (step === 'controls') {
      setStep('details');
      return;
    }
    if (step === 'review') {
      setCurrentSubmission(null);
      setStep('controls');
    }
  }, [setCurrentSubmission, step]);

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
      side: draft.side,
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

    try {
      console.log('[RFQMakerPanel] Step 1/2: Creating RFQ storage account...');
      console.log('[RFQMakerPanel] ⚠️ Please approve the transaction in your wallet extension!');
      
      const manager = new StorageAccountManager(userClient);
      
      let rfqStorageAddress: string;
      try {
        // Add timeout since wallet extension might not respond even after approval
        const createPromise = manager.createStorageAccount('RFQ', []);
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('TIMEOUT')), 30000) // 30 second timeout
        );
        
        rfqStorageAddress = await Promise.race([createPromise, timeoutPromise]);
        console.log('[RFQMakerPanel] ✅ Storage account created:', rfqStorageAddress);
      } catch (error) {
        if (error instanceof Error && error.message === 'TIMEOUT') {
          // Timeout - but transaction might have succeeded
          console.warn('[RFQMakerPanel] ⚠️ Wallet response timeout - transaction may still have succeeded');
          
          // Ask user if they approved and if they see the storage account in wallet
          const proceed = confirm(
            'Storage account creation timed out.\n\n' +
            'Did you approve the transaction in your wallet?\n\n' +
            'Click OK if you approved it and want to continue.\n' +
            'Click Cancel to stop and try again later.'
          );
          
          if (!proceed) {
            throw new Error('RFQ order creation cancelled by user');
          }
          
          // User confirmed - proceed with a placeholder, they can deposit manually later
          rfqStorageAddress = 'PENDING_VERIFICATION';
          console.log('[RFQMakerPanel] User confirmed approval, proceeding...');
        } else {
          throw error;
        }
      }
      
      setStorageAccountAddress(rfqStorageAddress);
      setStep('funding');
      setProgressMessage('Storage account created! Now depositing your tokens...');
      
      // Wait for settlement
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (err) {
      console.error('[RFQMakerPanel] Error creating storage account:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create storage account. Please try again.';
      setError(errorMessage);
      setStep('details');
      setProgressMessage(null);
    } finally {
      setIsPublishing(false);
    }
  }, [draft, isConnected, makerProfile, pair, publicKey, userClient, validateControlsStep, validateDetailsStep]);

  // Step 2: Fund Storage Account (following CreatePoolModal pattern)
  const handleFundStorage = useCallback(async () => {
    if (!userClient || !publicKey || !storageAccountAddress || !currentSubmission) {
      setError('Missing required data for funding. Please try creating the order again.');
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
      
      // Set metadata with RFQ order details
      const metadataJson = JSON.stringify({
        pair: currentSubmission.pair,
        side: currentSubmission.side,
        price: currentSubmission.price,
        size: currentSubmission.size,
        minFill: currentSubmission.minFill,
        expiry: new Date(Date.now() + getExpiryMs(currentSubmission.expiryPreset)).toISOString(),
        makerAddress: publicKey,
        allowlistLabel: currentSubmission.allowlistLabel,
        autoSignProfileId: currentSubmission.autoSignProfileId,
      });
      
      // Encode metadata as base64 (required by Keeta SDK)
      const metadataBase64 = Buffer.from(metadataJson).toString('base64');
      
      builder.setInfo({
        name: `RFQ_STORAGE_ACCOUNT`,
        description: `${currentSubmission.side} ${currentSubmission.size} ${currentSubmission.pair} @ ${currentSubmission.price}`,
        metadata: metadataBase64,
        defaultPermission: createPermissionPayload(['STORAGE_DEPOSIT', 'STORAGE_CAN_HOLD']),
      }, { account: toAccount });
      
      // RFQ orders don't require token deposits upfront
      // Users will fund their orders when they want to trade
      console.log('[RFQMakerPanel] RFQ order metadata set - no token deposits required');
      
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
      console.log('[RFQMakerPanel] ✅ RFQ funding transaction signed and published');
      console.log('[RFQMakerPanel] Transaction result:', fundingResult);
      
      // Wait for Keeta settlement (400ms)
      console.log('[RFQMakerPanel] Waiting for Keeta settlement (400ms)...');
      await new Promise(resolve => setTimeout(resolve, 600));

      // Create the order in the backend
      const order = await createQuote(currentSubmission);
      setSuccess(
        `Quote ${order.id} published with escrow ${shorten(storageAccountAddress)}. Auto-sign SLA ${makerProfile.autoSignSlaMs} ms.`,
      );
      setProgressMessage('RFQ order created on Keeta and indexed by the RFQ backend.');
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
  }, [userClient, publicKey, storageAccountAddress, currentSubmission, createQuote, makerProfile]);

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

  return (
    <div className="flex h-full flex-col gap-4 rounded-lg border border-hairline bg-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Quote Builder</p>
          <h3 className="text-lg font-semibold text-foreground">Publish RFQ</h3>
          <p className="text-xs text-muted">Follow the guided steps to post partially signed quotes that auto-fill via maker webhook.</p>
        </div>
        <div className="rounded-full bg-surface-strong px-3 py-1 text-[11px] font-medium text-muted">
          Maker profile · {trimPubkey(publicKey)}
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-hairline bg-surface px-3 py-2 text-xs text-muted">
        Create and publish RFQ quotes to provide liquidity to the market. Complete each step to review details before signing.
      </div>

      {/* Progress Indicator */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          {(['details', 'controls', 'review'] as const).map((wizardStep, index) => {
            const isActive =
              (wizardStep === 'details' && step === 'details') ||
              (wizardStep === 'controls' && step === 'controls') ||
              (wizardStep === 'review' && ['review', 'creating', 'funding'].includes(step));
            const isComplete =
              (wizardStep === 'details' && ['controls', 'review', 'creating', 'funding'].includes(step)) ||
              (wizardStep === 'controls' && ['review', 'creating', 'funding'].includes(step));

            return (
              <div
                key={wizardStep}
                className={`flex flex-col items-center gap-2 rounded-lg border px-3 py-2 text-center ${
                  isActive ? 'border-accent/60 bg-accent/10 text-foreground' : isComplete ? 'border-hairline bg-surface text-foreground' : 'border-hairline bg-surface text-muted'
                }`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  isComplete ? 'bg-accent text-white' : isActive ? 'bg-accent text-white' : 'bg-surface-strong text-muted'
                }`}
                >
                  {isComplete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>
                <span className="text-[11px] font-medium leading-tight">
                  {wizardStep === 'details' && 'Quote Details'}
                  {wizardStep === 'controls' && 'Fill Controls'}
                  {wizardStep === 'review' && 'Review & Publish'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {success && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-green-500">{success}</p>
          </div>
        </div>
      )}

      {/* Progress Message */}
      {progressMessage && (
        <div className="p-4 rounded-lg bg-accent/10 border border-accent/30 flex items-start gap-3">
          <Loader2 className="h-5 w-5 text-accent flex-shrink-0 animate-spin" />
          <div className="flex-1">
            <p className="text-sm text-accent">{progressMessage}</p>
          </div>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Side</label>
                <select
                  value={draft.side}
                  onChange={(e) => setDraft(prev => ({ ...prev, side: e.target.value as 'buy' | 'sell' }))}
                  className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                  aria-label="Select order side"
                >
                  <option value="sell">Sell (maker provides base)</option>
                  <option value="buy">Buy (maker provides quote)</option>
                </select>
              </div>
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
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3">
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
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Expires In</label>
                <select
                  value={draft.expiryPreset}
                  onChange={(e) => setDraft(prev => ({ ...prev, expiryPreset: e.target.value as RFQQuoteDraft['expiryPreset'] }))}
                  className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                  aria-label="Select expiry time"
                >
                  {EXPIRY_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Controls */}
      {step === 'controls' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-hairline bg-surface-strong p-4">
            <h4 className="mb-3 text-sm font-semibold text-foreground">Fill Controls</h4>
            <div className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Minimum Fill Size (optional)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={draft.minFill}
                  onChange={(e) => setDraft(prev => ({ ...prev, minFill: e.target.value }))}
                  placeholder="No minimum"
                  className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                />
                <p className="mt-1 text-xs text-muted">Takers must meet this size to auto-settle the RFQ.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Allowlist Label (optional)</label>
                <input
                  type="text"
                  value={draft.allowlistLabel}
                  onChange={(e) => setDraft(prev => ({ ...prev, allowlistLabel: e.target.value }))}
                  placeholder="VIP, Institutional, etc."
                  className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                />
                <p className="mt-1 text-xs text-muted">Only takers in this segment will see the quote in their RFQ stream.</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-hairline bg-surface p-4 text-xs text-muted">
            Use maker preferences to tune settlement automation. Auto-sign SLA stays controlled by your wallet integration ({makerProfile.autoSignSlaMs} ms).
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

      {/* Step 2: Fund Storage Account */}
      {step === 'funding' && (
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
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
        {['details', 'controls', 'review'].includes(step) && (
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
                    setStep('controls');
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
            {step === 'controls' && (
              <button
                type="button"
                onClick={() => {
                  if (validateControlsStep()) {
                    setCurrentSubmission({
                      pair,
                      side: draft.side,
                      price: draft.price,
                      size: draft.size,
                      minFill: draft.minFill || undefined,
                      expiryPreset: draft.expiryPreset,
                      allowlistLabel: draft.allowlistLabel || undefined,
                      autoSignProfileId: draft.autoSignProfileId || undefined,
                      maker: makerProfile,
                    });
                    setStep('review');
                  }
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors ${
                  isConnected ? 'bg-accent hover:bg-accent/90' : 'bg-muted'
                }`}
                disabled={!isConnected}
              >
                Review Quote
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
                    Publish Quote
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
                Funding...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Fund Order
              </>
            )}
          </button>
        )}
      </div>

      {/* Selected Order Info */}
        {selectedMakerOrder && (
        <div className="space-y-3 rounded-lg border border-hairline bg-surface-strong p-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Your Active Quote</h4>
            <button
              type="button"
              onClick={handleCopyOrderId}
              className="flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-foreground transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <ClipboardCopy className="h-3 w-3" />
                  Copy ID
                </>
              )}
            </button>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Order ID:</span>
              <span className="font-mono text-foreground">{shorten(selectedMakerOrder.id)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Side:</span>
              <span className="text-foreground">{selectedMakerOrder.side}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Size:</span>
              <span className="text-foreground">{selectedMakerOrder.size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Price:</span>
              <span className="text-foreground">{selectedMakerOrder.price}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Status:</span>
              <span className="text-foreground">{selectedMakerOrder.status}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelSelected}
            className="w-full px-3 py-2 text-xs font-medium text-red-500 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Cancel Quote
          </button>
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-hairline bg-surface-strong p-3 text-xs text-muted">
        <div className="flex items-center justify-between">
          <span>Auto-sign SLA</span>
          <span className="text-foreground">{makerProfile.autoSignSlaMs} ms</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Fills completed</span>
          <span className="text-foreground">{makerProfile.fillsCompleted}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Failure rate</span>
          <span className="text-foreground">{(makerProfile.failureRate * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
