'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCopy, Info, Loader2 } from 'lucide-react';

import { useRFQContext } from '@/app/contexts/RFQContext';
import { useWallet } from '@/app/contexts/WalletContext';
import {
  getMakerTokenAddressFromOrder,
  getMakerTokenDecimalsFromOrder,
  getTakerTokenAddressFromOrder,
  getTakerTokenDecimalsFromOrder,
  toBaseUnits,
} from '@/app/lib/token-utils';
import { declareIntention, fetchDeclarations } from '@/app/lib/rfq-api';
import type { RFQDeclaration, DeclarationStatus } from '@/app/types/rfq';

function formatCurrency(value?: number): string {
  if (!value || Number.isNaN(value)) {
  return '0.00';
  }

  return value.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  });
}

function formatToken(value?: number): string {
  if (!value || Number.isNaN(value)) {
  return '0';
  }

  return value.toLocaleString('en-US', {
  minimumFractionDigits: value < 1 ? 4 : 2,
  maximumFractionDigits: value < 1 ? 6 : 2,
  });
}

function shorten(address: string, chars = 4): string {
  if (!address || address.length <= chars * 2) {
  return address;
  }
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

interface RFQTakerPanelProps {
  mode: 'rfq_taker' | 'rfq_maker';
  onModeChange: (mode: 'rfq_taker' | 'rfq_maker') => void;
}

export function RFQTakerPanel({ mode, onModeChange }: RFQTakerPanelProps): React.JSX.Element {
  const {
  selectedOrder,
  fillAmount,
  setFillAmount,
  requestFill,
  isFilling,
  lastFillResult,
  escrowState,
  escrowError,
  isVerifyingEscrow,
  refreshEscrowState,
  lastEscrowVerification,
  } = useRFQContext();
  const { isConnected, publicKey, userClient, getTokenMetadata } = useWallet();
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Declaration flow state
  const [hasActiveDeclaration, setHasActiveDeclaration] = useState(false);
  const [declarationStatus, setDeclarationStatus] = useState<DeclarationStatus | null>(null);
  const [isDeclaring, setIsDeclaring] = useState(false);

  useEffect(() => {
  if (!lastFillResult) {
  return;
  }

  if (lastFillResult.status === 'settled') {
  setSuccessMessage(`Maker co-signed in ${lastFillResult.latencyMs} ms`);
  setLocalError(null);
  } else if (lastFillResult.status === 'rejected') {
  setLocalError('Quote expired before maker signature landed. Select a fresh RFQ and try again.');
  setSuccessMessage(null);
  }
  }, [lastFillResult]);

  useEffect(() => {
  if (!selectedOrder) {
  setLocalError(null);
  setSuccessMessage(null);
  }
  }, [selectedOrder]);

  const settlementPreview = useMemo(() => {
  if (!selectedOrder || !fillAmount) {
  return null;
  }

  const grossUsd = fillAmount * selectedOrder.price;
  const takerFeeBps = 5; // 0.05%
  const feeAmount = (grossUsd * takerFeeBps) / 10_000;
  const netUsd = grossUsd - feeAmount;

  return {
  grossUsd,
  feeUsd: feeAmount,
  netUsd,
  takerFeeBps,
  };
  }, [fillAmount, selectedOrder]);

  const escrowInsights = useMemo(() => {
  if (!selectedOrder) {
  return {
  makerTokenAddress: undefined,
  makerTokenDecimals: 0,
  takerTokenAddress: undefined,
  lockedAmount: null as number | null,
  };
  }

  const makerTokenAddress = getMakerTokenAddressFromOrder(selectedOrder);
  const makerTokenDecimals = getMakerTokenDecimalsFromOrder(selectedOrder);
  const takerTokenAddress = getTakerTokenAddressFromOrder(selectedOrder);
  const balanceEntry = escrowState?.balances.find((entry) => entry.token === makerTokenAddress);
  const lockedAmount = balanceEntry ? balanceEntry.normalizedAmount : null;

  return { makerTokenAddress, makerTokenDecimals, takerTokenAddress, lockedAmount };
  }, [escrowState, selectedOrder]);

  const { baseAsset, quoteAsset } = useMemo(() => {
  if (!selectedOrder) {
  return { baseAsset: 'BASE', quoteAsset: 'QUOTE' };
  }
  const [base, quote] = selectedOrder.pair.split('/');
  return {
  baseAsset: base ?? selectedOrder.pair,
  quoteAsset: quote ?? base ?? selectedOrder.pair,
  };
  }, [selectedOrder]);

  const handleFillAmountChange = useCallback(
  (event: ChangeEvent<HTMLInputElement>) => {
  const value = Number.parseFloat(event.target.value);
  if (Number.isNaN(value)) {
  setFillAmount(undefined);
  return;
  }
  setFillAmount(value);
  },
  [setFillAmount],
  );

  const handleCopyUnsignedBlock = useCallback(() => {
  if (!selectedOrder) {
  return;
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
  const reference = selectedOrder.storageAccount ?? selectedOrder.unsignedBlock ?? 'No reference available';
  void navigator.clipboard.writeText(reference);
  setCopied(true);
  setTimeout(() => setCopied(false), 1200);
  }
  }, [selectedOrder]);

  const handleDeclareIntention = useCallback(async () => {
  if (!selectedOrder || !fillAmount) {
  setLocalError('Select a quote and enter a fill size first.');
  return;
  }

  if (!isConnected || !publicKey) {
  setLocalError('Connect your wallet to declare intention.');
  return;
  }

  if (selectedOrder.minFill && fillAmount < selectedOrder.minFill) {
  setLocalError(`Minimum fill is ${formatToken(selectedOrder.minFill)} base.`);
  return;
  }

  if (fillAmount > selectedOrder.size) {
  setLocalError('Fill amount exceeds maker size. Reduce the quantity.');
  return;
  }

  const expiryTimestamp = new Date(selectedOrder.expiry).getTime();
  if (expiryTimestamp < Date.now() + 30_000) {
  setLocalError('Quote expires in under 30 seconds. Choose a fresher order.');
  return;
  }

  if (escrowInsights.lockedAmount !== null && fillAmount > escrowInsights.lockedAmount + 1e-9) {
  setLocalError('Fill amount exceeds verified on-chain escrow balance.');
  return;
  }

  setLocalError(null);
  setSuccessMessage(null);
  setIsDeclaring(true);

  try {
  // Build atomic swap transaction in frontend using Keeta SDK
  console.log('[RFQTakerPanel] Building atomic swap transaction...');
  
  if (!userClient) {
  throw new Error('Wallet client not available');
  }
  
  const builder = userClient.initBuilder();
  if (!builder) {
  throw new Error('Failed to initialize transaction builder');
  }

  // Get token addresses for the swap
  // Use the base token from userClient (KTA - Keeta's native token)
  const baseToken = userClient.baseToken;
  
  console.log('[RFQTakerPanel] Debug - baseToken:', baseToken);
  console.log('[RFQTakerPanel] Debug - baseToken type:', typeof baseToken);
  
  // For atomic swap: Both sides use the same base token (KTA)
  // This is the standard Keeta pattern for token transfers
  if (!baseToken) {
  throw new Error('Base token not available from wallet. Please ensure wallet is properly connected.');
  }
  
  // Use the same base token for both sides (KTA)
  const makerTokenAddress = (baseToken as any)?.publicKeyString || 'base'; // What Maker is offering (KTA)
  const takerTokenAddress = (baseToken as any)?.publicKeyString || 'base'; // What Taker is sending (KTA)
  
  console.log('[RFQTakerPanel] Debug - makerTokenAddress:', makerTokenAddress);
  console.log('[RFQTakerPanel] Debug - takerTokenAddress:', takerTokenAddress);

  // Fetch token metadata from blockchain instead of using cache
  const makerTokenMetadata = await getTokenMetadata(makerTokenAddress);
  const takerTokenMetadata = await getTokenMetadata(takerTokenAddress);
  
  if (!makerTokenMetadata) {
    throw new Error('Failed to fetch maker token metadata from blockchain');
  }
  if (!takerTokenMetadata) {
    throw new Error('Failed to fetch taker token metadata from blockchain');
  }
  
  const makerTokenDecimals = makerTokenMetadata.decimals;
  const takerTokenDecimals = takerTokenMetadata.decimals;
  
  // Convert decimal amounts to base units (smallest token units)
  const makerAmountBigInt = toBaseUnits(fillAmount, makerTokenDecimals);
  const takerAmountBigInt = toBaseUnits(fillAmount * selectedOrder.price, takerTokenDecimals);
  
  // Convert to strings for serialization
  const makerAmount = makerAmountBigInt.toString();
  const takerAmount = takerAmountBigInt.toString();

  console.log('[RFQTakerPanel] Decimal conversion debug:');
  console.log('[RFQTakerPanel] - fillAmount:', fillAmount);
  console.log('[RFQTakerPanel] - makerTokenDecimals:', makerTokenDecimals);
  console.log('[RFQTakerPanel] - takerTokenDecimals:', takerTokenDecimals);
  console.log('[RFQTakerPanel] - makerAmountBigInt:', makerAmountBigInt.toString());
  console.log('[RFQTakerPanel] - takerAmountBigInt:', takerAmountBigInt.toString());
  
  console.log('[RFQTakerPanel] Atomic swap terms:');
  console.log('[RFQTakerPanel] 1. Taker receives:', makerAmount, 'from storage account (funded by Maker)');
  console.log('[RFQTakerPanel] 2. Taker sends:', takerAmount, 'to Maker');
  console.log('[RFQTakerPanel] Debug - takerAmount type:', typeof takerAmount);
  console.log('[RFQTakerPanel] Debug - makerAmount value:', makerAmount);
  console.log('[RFQTakerPanel] Debug - takerAmount value:', takerAmount);

  // Debug: Check what methods are available on the builder
  console.log('[RFQTakerPanel] Builder methods:', Object.getOwnPropertyNames(builder));
  console.log('[RFQTakerPanel] Builder prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(builder)));
  
  // Build the atomic swap transaction following Keeta's pattern
  // Taker declares: "I receive Y Token_A from storage and send X Token_B to Maker"
  
  // Get storage account address from the order
  if (!selectedOrder.maker?.id) {
  throw new Error('Maker address not found in order');
  }
  
  console.log('[RFQTakerPanel] Debug - selectedOrder:', selectedOrder);
  console.log('[RFQTakerPanel] Debug - storageAccount:', selectedOrder.storageAccount);
  console.log('[RFQTakerPanel] Debug - unsignedBlock:', selectedOrder.unsignedBlock);
  console.log('[RFQTakerPanel] Debug - maker.id:', selectedOrder.maker.id);
  
  // For atomic swaps, the Taker receives from the storage account
  // The storage account is created and funded by the Maker when they fund their quote
  const storageAccountAddress = selectedOrder.storageAccount;
  console.log('[RFQTakerPanel] Debug - using storageAccountAddress:', storageAccountAddress);
  console.log('[RFQTakerPanel] Debug - storageAccountAddress type:', typeof storageAccountAddress);
  console.log('[RFQTakerPanel] Debug - storageAccountAddress length:', storageAccountAddress?.length);
  console.log('[RFQTakerPanel] Debug - storageAccountAddress starts with:', storageAccountAddress?.substring(0, 10));
  
  // Validate that the storage account exists and is valid
  if (!storageAccountAddress) {
  throw new Error('Storage account not found. The Maker must fund their quote first before you can take it.');
  }
  
  if (typeof storageAccountAddress !== 'string' || storageAccountAddress.length === 0) {
  throw new Error('Invalid storage account address - must be a non-empty string');
  }
  
  if (!storageAccountAddress.startsWith('keeta_')) {
  throw new Error('Invalid storage account address format - must be a valid Keeta address starting with "keeta_"');
  }
  
  // Additional validation: ensure it's a real Keeta address
  if (storageAccountAddress.length < 10 || !storageAccountAddress.includes('_')) {
  throw new Error('Invalid storage account address format. The Maker must fund their quote first.');
  }
  
  // 1. Taker receives Token_A from storage account (funded by Maker)
  const storageAccount = { publicKeyString: storageAccountAddress };
  const makerAccount = { publicKeyString: selectedOrder.maker.id };
  
  // Ensure token addresses are strings
  const makerTokenAddressString = typeof makerTokenAddress === 'string' 
  ? makerTokenAddress 
  : (makerTokenAddress && typeof makerTokenAddress === 'object' && 'publicKeyString' in makerTokenAddress)
  ? (makerTokenAddress as { publicKeyString: string }).publicKeyString
  : String(makerTokenAddress);
  const takerTokenAddressString = typeof takerTokenAddress === 'string' 
  ? takerTokenAddress 
  : (takerTokenAddress && typeof takerTokenAddress === 'object' && 'publicKeyString' in takerTokenAddress)
  ? (takerTokenAddress as { publicKeyString: string }).publicKeyString
  : String(takerTokenAddress);
  
  const makerTokenRef = { publicKeyString: makerTokenAddressString };
  const takerTokenRef = { publicKeyString: takerTokenAddressString };

  console.log('[RFQTakerPanel] Debug - storageAccount:', storageAccount);
  console.log('[RFQTakerPanel] Debug - makerAccount:', makerAccount);
  console.log('[RFQTakerPanel] Debug - makerTokenRef:', makerTokenRef);
  console.log('[RFQTakerPanel] Debug - takerTokenRef:', takerTokenRef);
  console.log('[RFQTakerPanel] Debug - makerAmount:', makerAmount);
  console.log('[RFQTakerPanel] Debug - takerAmount:', takerAmount);

  // Check if builder methods are available
  if (typeof builder.receive !== 'function') {
  console.error('[RFQTakerPanel] builder.receive is not a function:', typeof builder.receive);
  throw new Error('Builder does not support receive operations');
  }
  if (typeof builder.send !== 'function') {
  console.error('[RFQTakerPanel] builder.send is not a function:', typeof builder.send);
  throw new Error('Builder does not support send operations');
  }
  
  // 1. Taker receives Token_A from storage account
  console.log('[RFQTakerPanel] Building receive operation:');
  console.log('[RFQTakerPanel] - from (storageAccount):', JSON.stringify(storageAccount));
  console.log('[RFQTakerPanel] - amount (makerAmount):', JSON.stringify(makerAmount));
  console.log('[RFQTakerPanel] - token (makerTokenRef):', JSON.stringify(makerTokenRef));
  
  builder.receive(storageAccount, makerAmount, makerTokenRef);
  console.log('[RFQTakerPanel] builder.receive completed successfully');
  
  // 2. Taker sends Token_B to Maker
  console.log('[RFQTakerPanel] Building send operation:');
  console.log('[RFQTakerPanel] - to (makerAccount):', JSON.stringify(makerAccount));
  console.log('[RFQTakerPanel] - amount (takerAmount):', JSON.stringify(takerAmount));
  console.log('[RFQTakerPanel] - token (takerTokenRef):', JSON.stringify(takerTokenRef));
  
  builder.send(makerAccount, takerAmount, takerTokenRef);
  console.log('[RFQTakerPanel] builder.send completed successfully');

  console.log('[RFQTakerPanel] Atomic swap: Taker receives Token_A from storage and sends Token_B to Maker');
  console.log('[RFQTakerPanel] Both operations will execute atomically');
  
  // Build the atomic swap operations
  console.log('[RFQTakerPanel] Atomic swap transaction built successfully');
  console.log('[RFQTakerPanel] Operations count:', (builder._operations as unknown[])?.length || 0);
  
  // For atomic swaps, the Taker creates an UNSIGNED block for the Maker to sign
  // Following Keeta's atomic swap pattern: Taker builds, Maker signs and publishes
  console.log('[RFQTakerPanel] Computing unsigned atomic swap block...');
  
  try {
    // Compute the transaction blocks but DO NOT publish them
    // This creates the unsigned block that the Maker will sign
    const computedResult = await (builder as any).computeBuilderBlocks();
    const { blocks } = computedResult;
    console.log('[RFQTakerPanel] Computed unsigned blocks:', blocks.length);
    
    if (!blocks || blocks.length === 0) {
      throw new Error('Failed to compute atomic swap blocks');
    }
    
    // Get the unsigned block data
    // The blocks now contain actual bytes from the wallet extension
    const unsignedBlock = blocks[0];
    console.log('[RFQTakerPanel] Raw unsigned block data:', unsignedBlock);
    console.log('[RFQTakerPanel] Block keys:', Object.keys(unsignedBlock));
    
    // Try to get hex bytes from different possible fields
    let unsignedBlockHex = unsignedBlock.bytesHex || '';
    
    // Fallback: convert bytes array to hex if bytesHex is not available
    if (!unsignedBlockHex && unsignedBlock.bytes) {
      const bytesArray = unsignedBlock.bytes;
      unsignedBlockHex = bytesArray.map((byte: number) => byte.toString(16).padStart(2, '0')).join('');
      console.log('[RFQTakerPanel] Converted bytes array to hex:', unsignedBlockHex.substring(0, 20) + '...');
    }
    
    const unsignedBlockHash = unsignedBlock.hash || 'unknown_hash';
    console.log('[RFQTakerPanel] Created unsigned atomic swap block with hash:', unsignedBlockHash);
    console.log('[RFQTakerPanel] Block bytes (hex):', unsignedBlockHex.substring(0, 20) + '...');
    console.log('[RFQTakerPanel] Block bytes length:', unsignedBlockHex.length);
    
    // Validate that we have block data
    if (!unsignedBlockHex || unsignedBlockHex.length === 0) {
      throw new Error('Failed to get unsigned block bytes from wallet extension');
    }
    
    // Create atomic swap metadata for the Maker to review
    const atomicSwapMetadata = {
      type: 'atomic_swap_declaration',
      version: '1.0',
      taker: {
        address: publicKey,
        receives: {
          amount: makerAmount,
          decimals: makerTokenDecimals,
          fieldType: makerTokenMetadata.fieldType,
          token: makerTokenAddressString,
          from: selectedOrder.storageAccount
        },
        sends: {
          amount: takerAmount,
          decimals: takerTokenDecimals,
          fieldType: takerTokenMetadata.fieldType,
          token: takerTokenAddressString,
          to: selectedOrder.maker.id
        }
      },
      terms: {
        atomic: true,
        conditional: true,
        expiry: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      },
      metadata: {
        orderId: selectedOrder.id,
        pair: selectedOrder.pair,
        side: selectedOrder.side,
        price: selectedOrder.price,
        timestamp: Date.now()
      }
    };
    
    // Combine the unsigned block with metadata
    const declarationData = {
      unsignedBlock: unsignedBlockHex, // Send the actual block bytes as hex
      blockHash: unsignedBlockHash,    // Also include the hash for reference
      metadata: atomicSwapMetadata
    };
    
    const serializedDeclaration = JSON.stringify(declarationData);
    console.log('[RFQTakerPanel] Sending atomic swap declaration to Maker...');
    
    // Send declaration with the unsigned atomic swap block
    await declareIntention(selectedOrder.id, {
      takerAddress: publicKey,
      fillAmount,
      unsignedAtomicSwapBlock: serializedDeclaration,
    });

    setHasActiveDeclaration(true);
    setDeclarationStatus('pending');
    setSuccessMessage('Atomic swap declaration sent! Maker will review and sign the transaction...');
    return;
    
  } catch (error) {
    console.error('[RFQTakerPanel] Error computing atomic swap block:', error);
    setLocalError(error instanceof Error ? error.message : 'Failed to create atomic swap declaration');
    return;
  }
  } catch (error) {
  console.error('[RFQTakerPanel] Error building atomic swap:', error);
  setLocalError(error instanceof Error ? error.message : 'Failed to build atomic swap transaction');
  } finally {
  setIsDeclaring(false);
  }
  }, [escrowInsights.lockedAmount, fillAmount, isConnected, publicKey, selectedOrder, userClient, getTokenMetadata]);

  // Removed handleExecuteSwap - atomic swap execution happens automatically when Maker approves

  // Check for declaration status updates
  useEffect(() => {
  if (!hasActiveDeclaration || !selectedOrder) {
  return;
  }

  const checkDeclarationStatus = async () => {
  try {
  const declarations = await fetchDeclarations(selectedOrder.id);
  const myDeclaration = declarations.find(decl => decl.takerAddress === publicKey);
  
  if (myDeclaration) {
  setDeclarationStatus(myDeclaration.status);
  
  if (myDeclaration.status === 'approved') {
  setSuccessMessage('Declaration approved! You can now execute the atomic swap.');
  } else if (myDeclaration.status === 'rejected') {
  setLocalError('Your declaration was rejected by the maker.');
  setHasActiveDeclaration(false);
  setDeclarationStatus(null);
  }
  }
  } catch (error) {
  console.error('Failed to check declaration status:', error);
  }
  };

  const interval = setInterval(checkDeclarationStatus, 2000); // Check every 2 seconds
  return () => clearInterval(interval);
  }, [hasActiveDeclaration, selectedOrder, publicKey]);

  // Always show the toggle interface, even when no orders are available

  return (
  <div className="flex h-full flex-col gap-4 rounded-lg border border-hairline bg-surface p-4">
  {/* RFQ Mode Toggle */}
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

  {selectedOrder ? (
  <>
  <div className="flex items-start justify-between gap-3">
  <div>
  <p className="text-xs uppercase tracking-wide text-muted">Selected Quote</p>
          <h3 className="text-lg font-semibold text-foreground">{selectedOrder.pair}</h3>
          <p className="text-xs text-muted">
            Maker {selectedOrder.maker.displayName} · Reputation {selectedOrder.maker.reputationScore}
          </p>
  </div>
  <button
  type="button"
  onClick={handleCopyUnsignedBlock}
  className="inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-1 text-[11px] font-medium text-muted transition-colors hover:border-accent hover:text-foreground"
  >
  <ClipboardCopy className="h-3 w-3" />
  {copied ? 'Copied!' : 'Escrow ref'}
  </button>
  </div>

  <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface-strong p-3 text-xs text-muted">
  <div>
  <p className="font-medium text-foreground">Price</p>
  <p>${formatCurrency(selectedOrder.price)}</p>
  </div>
  <div>
  <p className="font-medium text-foreground">Size</p>
  <p>{formatToken(selectedOrder.size)} base</p>
  </div>
  {selectedOrder.minFill && (
  <div>
  <p className="font-medium text-foreground">Min fill</p>
  <p>{formatToken(selectedOrder.minFill)} base</p>
  </div>
  )}
  <div>
  <p className="font-medium text-foreground">Expiry</p>
  <p>{new Date(selectedOrder.expiry).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
  </div>
  </div>

  <div className="space-y-2 rounded-lg border border-hairline bg-surface px-3 py-2 text-xs">
  <div className="flex items-center justify-between">
  <p className="font-medium text-foreground">Escrow verification</p>
  <button
  type="button"
  onClick={() => refreshEscrowState()}
  disabled={isVerifyingEscrow}
  className="rounded-full border border-hairline px-3 py-1 text-[11px] font-medium text-muted transition-colors hover:border-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
  >
  {isVerifyingEscrow ? 'Verifying…' : 'Refresh'}
  </button>
  </div>
  {escrowError ? (
  <p className="rounded bg-red-500/10 px-3 py-2 text-[11px] text-red-200">{escrowError}</p>
  ) : (
  <div className="space-y-2 text-muted">
  <div className="flex items-center justify-between gap-2 text-[11px]">
  <span>Storage account</span>
  <span className="font-mono text-foreground">{shorten(selectedOrder.storageAccount ?? selectedOrder.unsignedBlock ?? 'No address available')}</span>
  </div>
  <div className="flex items-center justify-between gap-2 text-[11px]">
  <span>Locked funds</span>
  <span className="text-foreground">
  {escrowInsights.lockedAmount != null
  ? `${formatToken(escrowInsights.lockedAmount)} ${selectedOrder.side === 'sell' ? quoteAsset : baseAsset}`
  : 'Pending verification'}
  </span>
  </div>
  <div className="flex items-center justify-between gap-2 text-[11px]">
  <span>Last checked</span>
  <span className="text-foreground">
  {lastEscrowVerification
  ? new Date(lastEscrowVerification).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  : 'Not yet verified'}
  </span>
  </div>
  </div>
  )}
  </div>

  {/* Atomic Swap Terms Display */}
  {fillAmount && fillAmount > 0 && (
  <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs">
  <div className="font-semibold text-blue-400 mb-2">Atomic Swap Terms</div>
  <div className="space-y-1 text-blue-300">
  <div>Storage → You: {formatToken(fillAmount)} {selectedOrder.side === 'sell' ? selectedOrder.pair.split('/')[0] : selectedOrder.pair.split('/')[1]}</div>
  <div>You → Maker: {formatToken(fillAmount * selectedOrder.price)} {selectedOrder.side === 'sell' ? selectedOrder.pair.split('/')[1] : selectedOrder.pair.split('/')[0]}</div>
  <div>Rate: {selectedOrder.price} {selectedOrder.pair}</div>
  </div>
  <div className="mt-2 text-blue-400/70">
  Both operations execute atomically - if either fails, both fail. No partial execution possible. The maker will sign and publish this transaction after reviewing your declaration.
  </div>
  </div>
  )}

  <label className="space-y-2">
  <span className="text-xs font-medium text-muted">Fill amount (base asset)</span>
  <input
  type="number"
  min={selectedOrder.minFill ?? 0}
  max={selectedOrder.size}
  step="0.0001"
  value={fillAmount ?? ''}
  onChange={handleFillAmountChange}
  className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
  placeholder="0.00"
  />
  </label>

  {settlementPreview && (
  <div className="rounded-lg border border-hairline bg-surface-strong p-3 text-xs text-muted">
  <div className="flex items-center justify-between">
  <span>Gross notional</span>
  <span className="text-foreground">${formatCurrency(settlementPreview.grossUsd)}</span>
  </div>
  <div className="flex items-center justify-between">
  <span>Taker fee ({settlementPreview.takerFeeBps / 100}% )</span>
  <span className="text-foreground">-${formatCurrency(settlementPreview.feeUsd)}</span>
  </div>
  <div className="flex items-center justify-between text-sm font-semibold text-foreground">
  <span>Net receive</span>
  <span>${formatCurrency(settlementPreview.netUsd)}</span>
  </div>
  </div>
  )}

  {localError && (
  <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
  <AlertTriangle className="mt-0.5 h-4 w-4" />
  <span>{localError}</span>
  </div>
  )}

  {successMessage && (
  <div className="flex items-start gap-2 rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-xs text-green-200">
  <CheckCircle2 className="mt-0.5 h-4 w-4" />
  <span>{successMessage}</span>
  </div>
  )}

  {/* Declaration Flow Buttons */}
  {!hasActiveDeclaration ? (
  <button
  type="button"
  onClick={handleDeclareIntention}
  disabled={!isConnected || isDeclaring}
  className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
  isConnected ? 'bg-accent hover:bg-accent/90' : 'bg-muted'
  }`}
  >
  {isDeclaring ? (
  <>
  <Loader2 className="h-4 w-4 animate-spin" />
  Declaring...
  </>
  ) : (
  'Declare Intention to Fill'
  )}
  </button>
  ) : declarationStatus === 'approved' ? (
  <div className="flex items-center justify-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-200">
  <CheckCircle2 className="h-4 w-4" />
  Atomic Swap Executed Successfully!
  </div>
  ) : (
  <div className="flex items-center justify-center gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
  <Loader2 className="h-4 w-4 animate-spin" />
  Waiting for Maker Approval...
  </div>
  )}

  <p className="text-[11px] text-muted">
    {!hasActiveDeclaration 
    ? "Declare your intention to fill this quote. You'll create an unsigned atomic swap transaction that the maker will review and sign."
    : declarationStatus === 'approved'
    ? "Your atomic swap declaration has been approved and the transaction has been executed on-chain!"
    : "Your atomic swap declaration is pending maker approval. The maker will review your unsigned transaction and sign it if approved."
    }
  </p>
  </>
  ) : (
  <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed border-hairline bg-surface px-4 py-6 text-center">
  <Info className="h-6 w-6 text-muted" />
  <div>
  <p className="text-sm font-medium text-foreground">Select a quote to get started</p>
  <p className="text-xs text-muted">Browse live RFQs in the order book and choose one to review settlement details.</p>
  </div>
  </div>
  )}
  </div>
  );
}

export default RFQTakerPanel;

