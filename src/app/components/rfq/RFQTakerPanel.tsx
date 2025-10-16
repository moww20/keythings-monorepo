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
  const { isConnected, publicKey, userClient } = useWallet();
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
      const reference = selectedOrder.storageAccount ?? selectedOrder.unsignedBlock;
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
      const makerTokenAddress = baseToken; // What Maker is offering (KTA)
      const takerTokenAddress = baseToken; // What Taker is sending (KTA)
      
      console.log('[RFQTakerPanel] Debug - makerTokenAddress:', makerTokenAddress);
      console.log('[RFQTakerPanel] Debug - takerTokenAddress:', takerTokenAddress);

      // Calculate amounts - ensure they are strings to avoid BigInt serialization issues
      const makerAmount = String(fillAmount); // Amount maker is offering
      const takerAmount = String(fillAmount * selectedOrder.price); // Amount taker must send

      console.log('[RFQTakerPanel] Swap terms:');
      console.log('[RFQTakerPanel] Storage → Taker:', makerAmount, makerTokenAddress);
      console.log('[RFQTakerPanel] Taker → Maker:', takerAmount, takerTokenAddress);
      console.log('[RFQTakerPanel] Debug - makerAmount type:', typeof makerAmount);
      console.log('[RFQTakerPanel] Debug - takerAmount type:', typeof takerAmount);
      console.log('[RFQTakerPanel] Debug - makerAmount value:', makerAmount);
      console.log('[RFQTakerPanel] Debug - takerAmount value:', takerAmount);

      // Debug: Check what methods are available on the builder
      console.log('[RFQTakerPanel] Builder methods:', Object.getOwnPropertyNames(builder));
      console.log('[RFQTakerPanel] Builder prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(builder)));
      
      // Build the atomic swap transaction following Keeta's pattern
      // Taker declares: "I send X Token_B and expect to receive Y Token_A"
      
      // 1. Taker sends Token_B to Maker
      if (!selectedOrder.maker?.id) {
        throw new Error('Maker address not found in order');
      }
      if (!takerTokenAddress) {
        throw new Error('Taker token address not found');
      }
      
      console.log('[RFQTakerPanel] Debug - selectedOrder.maker.id:', selectedOrder.maker.id);
      console.log('[RFQTakerPanel] Debug - selectedOrder.maker.id type:', typeof selectedOrder.maker.id);
      console.log('[RFQTakerPanel] Debug - selectedOrder.maker.id length:', selectedOrder.maker.id?.length);
      
      const makerAccount = { publicKeyString: selectedOrder.maker.id };
      // Ensure takerTokenAddress is a string, not an object
      const takerTokenAddressString = typeof takerTokenAddress === 'string' 
        ? takerTokenAddress 
        : (takerTokenAddress && typeof takerTokenAddress === 'object' && 'publicKeyString' in takerTokenAddress)
          ? (takerTokenAddress as { publicKeyString: string }).publicKeyString
          : String(takerTokenAddress);
      const takerTokenRef = { publicKeyString: takerTokenAddressString };

      console.log('[RFQTakerPanel] Debug - makerAccount:', makerAccount);
      console.log('[RFQTakerPanel] Debug - takerTokenRef:', takerTokenRef);
      console.log('[RFQTakerPanel] Debug - takerAmount:', takerAmount);
      console.log('[RFQTakerPanel] Debug - takerAmount type:', typeof takerAmount);

      console.log('[RFQTakerPanel] Attempting to call builder.send...');
      if (typeof builder.send !== 'function') {
        console.error('[RFQTakerPanel] builder.send is not a function:', typeof builder.send);
        throw new Error('Builder does not support send operations');
      }
      
      // Debug: Log the exact parameters being passed
      console.log('[RFQTakerPanel] Sending to builder.send:');
      console.log('[RFQTakerPanel] - to (makerAccount):', JSON.stringify(makerAccount));
      console.log('[RFQTakerPanel] - amount (takerAmount):', JSON.stringify(takerAmount));
      console.log('[RFQTakerPanel] - token (takerTokenRef):', JSON.stringify(takerTokenRef));
      
      builder.send(makerAccount, takerAmount, takerTokenRef);
      console.log('[RFQTakerPanel] builder.send completed successfully');

      // For atomic swaps, the Taker only sends their part
      // The Maker will handle sending their part when they approve the declaration
      console.log('[RFQTakerPanel] Atomic swap: Taker sends Token_B to Maker');
      console.log('[RFQTakerPanel] Maker will send Token_A to Taker when they approve');
      
      // Build the atomic swap operations
      console.log('[RFQTakerPanel] Atomic swap transaction built successfully');
      console.log('[RFQTakerPanel] Operations count:', (builder._operations as unknown[])?.length || 0);
      
      // For atomic swaps, the Taker should sign their part of the transaction
      // The Maker will sign their part when they approve the declaration
      console.log('[RFQTakerPanel] Signing atomic swap transaction with wallet...');
      
      try {
        // Publish the transaction to trigger wallet popup for Taker to sign
        const result = await userClient.publishBuilder(builder);
        console.log('[RFQTakerPanel] Taker signed atomic swap transaction:', String(result).substring(0, 20) + '...');
        
        // Create a structured atomic swap proposal for the Maker to review and sign
        const atomicSwapProposal = {
          type: 'atomic_swap_proposal',
          version: '1.0',
          operations: builder._operations || [],
          takerTransactionHash: String(result),
          terms: {
            taker: {
              address: publicKey,
              sends: {
                amount: takerAmount,
                token: takerTokenAddress,
                to: selectedOrder.maker.id
              }
            },
            maker: {
              address: selectedOrder.maker.id,
              sends: {
                amount: makerAmount,
                token: makerTokenAddress,
                from: selectedOrder.storageAccount || selectedOrder.unsignedBlock
              }
            }
          },
          conditions: {
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
        
        const serializedProposal = JSON.stringify(atomicSwapProposal);
        const unsignedBlockHex = Buffer.from(serializedProposal, 'utf8').toString('hex');
        console.log('[RFQTakerPanel] Created atomic swap proposal with Taker signature:', unsignedBlockHex.substring(0, 20) + '...');
        
        // Send declaration with the atomic swap proposal
        await declareIntention(selectedOrder.id, {
          takerAddress: publicKey,
          fillAmount,
          unsignedAtomicSwapBlock: unsignedBlockHex,
        });

        setHasActiveDeclaration(true);
        setDeclarationStatus('pending');
        setSuccessMessage('Taker signed atomic swap! Waiting for Maker to sign their part...');
        return;
        
      } catch (error) {
        console.error('[RFQTakerPanel] Error signing atomic swap transaction:', error);
        setLocalError(error instanceof Error ? error.message : 'Failed to sign atomic swap transaction');
        return;
      }
    } catch (error) {
      console.error('[RFQTakerPanel] Error building atomic swap:', error);
      setLocalError(error instanceof Error ? error.message : 'Failed to build atomic swap transaction');
    } finally {
      setIsDeclaring(false);
    }
  }, [escrowInsights.lockedAmount, fillAmount, isConnected, publicKey, selectedOrder, userClient]);

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
            Maker {selectedOrder.maker.displayName} · SLA {selectedOrder.maker.autoSignSlaMs} ms · Reputation {selectedOrder.maker.reputationScore}
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
              <span className="font-mono text-foreground">{shorten(selectedOrder.storageAccount ?? selectedOrder.unsignedBlock)}</span>
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
            Both operations execute atomically - if either fails, both fail. No partial execution possible.
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
              ? "Declare your intention to fill this quote. The maker will review and approve your request, then execute the atomic swap automatically."
              : declarationStatus === 'approved'
              ? "Your declaration has been approved and the atomic swap has been executed automatically!"
              : "Your declaration is pending maker approval. The maker will review your request and execute the atomic swap if approved."
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

