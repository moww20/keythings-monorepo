"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCopy, Info, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { useRFQContext } from '@/app/contexts/RFQContext';
import { useWallet } from '@/app/contexts/WalletContext';
import {
  getMakerTokenAddressFromOrder,
  getTakerTokenAddressFromOrder,
  toBaseUnits,
} from '@/app/lib/token-utils';
import { declareIntention, fetchDeclarations } from '@/app/lib/rfq-api';
import type { RFQDeclaration, DeclarationStatus } from '@/app/types/rfq';
import { RFQOrdersPanel } from './RFQOrdersPanel';

function formatCurrency(value?: number): string {
  if (!value || Number.isNaN(value)) {
  return '0.00';
  }

  return value.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  });
}

function formatNumber(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) {
  return '0';
  }

  return value.toLocaleString('en-US', {
  minimumFractionDigits: fractionDigits,
  maximumFractionDigits: fractionDigits,
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

function extractSymbolsFromPair(pair?: string): { maker?: string; taker?: string } {
  if (!pair || typeof pair !== 'string') {
  return { maker: undefined, taker: undefined };
  }

  const [makerSymbol, takerSymbol] = pair.split('/');
  return {
  maker: makerSymbol?.trim() || undefined,
  taker: takerSymbol?.trim() || undefined,
  };
}

const EscrowMetadataSchema = z
  .object({
    pair: z.string().optional(),
    atomicSwap: z
      .object({
        makerToken: z.string().optional(),
        takerToken: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

interface RFQTakerPanelProps {
  mode: 'rfq_taker' | 'rfq_maker' | 'rfq_orders';
  onModeChange: (mode: 'rfq_taker' | 'rfq_maker' | 'rfq_orders') => void;
  onPairChange?: (pair: string) => void;
  hideInternalTabs?: boolean;
}

export function RFQTakerPanel({ mode, onModeChange, onPairChange, hideInternalTabs }: RFQTakerPanelProps): React.JSX.Element {
  const {
  pair,
  availablePairs,
  recommendedPair,
  orders,
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

  // Get token metadata from wallet context instead of deprecated function
  const [makerTokenDecimals, setMakerTokenDecimals] = useState(9); // Default fallback
  const [makerTokenSymbol, setMakerTokenSymbol] = useState('-');
  const [takerTokenSymbol, setTakerTokenSymbol] = useState('-');

  const parsedEscrowMetadata = useMemo(() => {
    if (!escrowState?.metadata) {
    return null;
    }

    const parsed = EscrowMetadataSchema.safeParse(escrowState.metadata);
    if (!parsed.success) {
    return null;
    }

    return parsed.data;
  }, [escrowState?.metadata]);

  const escrowInsights = useMemo(() => {
    if (!selectedOrder) {
      return {
        makerTokenAddress: undefined as string | undefined,
        takerTokenAddress: undefined as string | undefined,
        lockedAmount: null as number | null,
        pairLabel: undefined as string | undefined,
        fallbackSymbols: {
          maker: undefined as string | undefined,
          taker: undefined as string | undefined,
        },
        makerDecimalsFromBalance: undefined as number | undefined,
      };
    }

    const metadataMakerToken = parsedEscrowMetadata?.atomicSwap?.makerToken;
    const metadataTakerToken = parsedEscrowMetadata?.atomicSwap?.takerToken;

    const makerTokenAddress = metadataMakerToken ?? getMakerTokenAddressFromOrder(selectedOrder);
    const takerTokenAddress = metadataTakerToken ?? getTakerTokenAddressFromOrder(selectedOrder);

    const balances = escrowState?.balances ?? [];
    const balanceEntry = balances.find((entry) =>
      metadataMakerToken ? entry.token === metadataMakerToken : entry.token === makerTokenAddress,
    );
    const lockedAmount = balanceEntry ? balanceEntry.normalizedAmount : null;

    const pairLabel = parsedEscrowMetadata?.pair ?? selectedOrder.pair;
    const fallbackSymbols = extractSymbolsFromPair(pairLabel);

    return {
      makerTokenAddress,
      takerTokenAddress,
      lockedAmount,
      pairLabel,
      fallbackSymbols,
      makerDecimalsFromBalance: balanceEntry?.decimals,
    };
  }, [escrowState, parsedEscrowMetadata, selectedOrder]);

  const derivedMakerTokenAddress = escrowInsights.makerTokenAddress;
  const derivedTakerTokenAddress = escrowInsights.takerTokenAddress;
  const fallbackMakerSymbol = escrowInsights.fallbackSymbols.maker;
  const fallbackTakerSymbol = escrowInsights.fallbackSymbols.taker;
  const fallbackPairLabel = escrowInsights.pairLabel;
  const fallbackMakerDecimals = escrowInsights.makerDecimalsFromBalance;

  // Fetch token metadata for display (symbols + decimals)
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!selectedOrder) {
        setMakerTokenSymbol('-');
        setTakerTokenSymbol('-');
        setMakerTokenDecimals(9);
        return;
      }

      const makerAddress = derivedMakerTokenAddress ?? getMakerTokenAddressFromOrder(selectedOrder);
      const takerAddress = derivedTakerTokenAddress ?? getTakerTokenAddressFromOrder(selectedOrder);

      try {
        if (makerAddress) {
          const metadata = await getTokenMetadata(makerAddress);
          if (metadata) {
            setMakerTokenDecimals(metadata.decimals ?? fallbackMakerDecimals ?? makerTokenDecimals);
            setMakerTokenSymbol(
              metadata.symbol ?? metadata.ticker ?? metadata.name ?? fallbackMakerSymbol ?? shorten(makerAddress),
            );
          } else {
            setMakerTokenDecimals(fallbackMakerDecimals ?? makerTokenDecimals);
            setMakerTokenSymbol(fallbackMakerSymbol ?? shorten(makerAddress));
          }
        }

        if (takerAddress) {
          const metadata = await getTokenMetadata(takerAddress);
          if (metadata) {
            setTakerTokenSymbol(
              metadata.symbol ?? metadata.ticker ?? metadata.name ?? fallbackTakerSymbol ?? shorten(takerAddress),
            );
          } else {
            setTakerTokenSymbol(fallbackTakerSymbol ?? shorten(takerAddress));
          }
        }
      } catch (error) {
        console.error('[RFQTakerPanel] Failed to fetch token metadata for display', error);
        if (makerAddress) {
          setMakerTokenDecimals(fallbackMakerDecimals ?? makerTokenDecimals);
          setMakerTokenSymbol(fallbackMakerSymbol ?? shorten(makerAddress));
        }
        if (takerAddress) {
          setTakerTokenSymbol(fallbackTakerSymbol ?? shorten(takerAddress));
        }
      }
    };

    fetchMetadata();
  }, [
    derivedMakerTokenAddress,
    derivedTakerTokenAddress,
    fallbackMakerDecimals,
    fallbackMakerSymbol,
    fallbackTakerSymbol,
    getTokenMetadata,
    makerTokenDecimals,
    selectedOrder,
  ]);

  const pairLabel = useMemo(() => {
    if (fallbackPairLabel) {
    return fallbackPairLabel;
    }
    if (!selectedOrder) {
    return '-/-';
    }
    if (makerTokenSymbol === '-' || takerTokenSymbol === '-') {
    return selectedOrder.pair;
    }
    return `${makerTokenSymbol}/${takerTokenSymbol}`;
  }, [fallbackPairLabel, makerTokenSymbol, selectedOrder, takerTokenSymbol]);

  const makerSymbolDisplay = makerTokenSymbol !== '-' ? makerTokenSymbol : fallbackMakerSymbol ?? '—';
  const takerSymbolDisplay = takerTokenSymbol !== '-' ? takerTokenSymbol : fallbackTakerSymbol ?? '—';

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
      setLocalError(`Minimum fill is ${formatToken(selectedOrder.minFill)} ${makerSymbolDisplay}.`);
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
      if (!userClient) {
        throw new Error('Wallet client not available');
      }

      const builder = userClient.initBuilder();
      if (!builder) {
        throw new Error('Failed to initialize transaction builder');
      }

      const makerTokenAddress = getMakerTokenAddressFromOrder(selectedOrder);
      const takerTokenAddress = getTakerTokenAddressFromOrder(selectedOrder);

      if (!isValidKeetaAddress(makerTokenAddress) || !isValidKeetaAddress(takerTokenAddress)) {
        throw new Error('RFQ order is missing token address mappings.');
      }

      const storageAccountAddress = selectedOrder.storageAccount ?? selectedOrder.unsignedBlock;
      if (!isValidKeetaAddress(storageAccountAddress)) {
        throw new Error('Maker has not provisioned a funded storage account for this quote yet.');
      }

      const makerTokenMetadata = await getTokenMetadata(makerTokenAddress);
      const takerTokenMetadata = await getTokenMetadata(takerTokenAddress);

      if (!makerTokenMetadata || !takerTokenMetadata) {
        throw new Error('Failed to fetch token metadata for the RFQ pair.');
      }

      const makerDecimals = makerTokenMetadata.decimals ?? 0;
      const takerDecimals = takerTokenMetadata.decimals ?? 0;

      const makerAmount = toBaseUnits(fillAmount, makerDecimals).toString();
      const takerNotional = fillAmount * selectedOrder.price;
      const takerAmount = toBaseUnits(takerNotional, takerDecimals).toString();

      const receiveFn = (builder as { receive?: (...args: unknown[]) => unknown }).receive;
      const sendFn = (builder as { send?: (...args: unknown[]) => unknown }).send;

      if (typeof receiveFn !== 'function' || typeof sendFn !== 'function') {
        throw new Error('Wallet builder does not support atomic swap operations.');
      }

      const storageAccount = { publicKeyString: storageAccountAddress };
      const makerAccount = { publicKeyString: selectedOrder.maker.id };
      const makerTokenRef = { publicKeyString: makerTokenAddress };
      const takerTokenRef = { publicKeyString: takerTokenAddress };

      await Promise.resolve(receiveFn.call(builder, storageAccount, makerAmount, makerTokenRef));
      await Promise.resolve(sendFn.call(builder, makerAccount, takerAmount, takerTokenRef));

      let computeResult: { blocks?: Array<Record<string, unknown>> } | undefined;
      if (typeof (builder as { computeBuilderBlocks?: () => Promise<unknown> }).computeBuilderBlocks === 'function') {
        computeResult = await (builder as any).computeBuilderBlocks();
      } else if (typeof (builder as { computeBlocks?: () => Promise<unknown> }).computeBlocks === 'function') {
        computeResult = await (builder as any).computeBlocks();
      } else {
        throw new Error('Wallet builder did not expose computeBuilderBlocks or computeBlocks.');
      }

      const unsignedBlockRecord = (computeResult?.blocks?.[0] ?? null) as Record<string, unknown> | null;
      if (!unsignedBlockRecord) {
        throw new Error('Wallet did not return an unsigned block for the declaration.');
      }

      let unsignedBlockHex =
        typeof unsignedBlockRecord.bytesHex === 'string'
          ? (unsignedBlockRecord.bytesHex as string)
          : '';
      const rawBytes = Array.isArray(unsignedBlockRecord.bytes)
        ? (unsignedBlockRecord.bytes as number[])
        : undefined;
      if (!unsignedBlockHex && Array.isArray(rawBytes)) {
        unsignedBlockHex = rawBytes.map((byte) => Number(byte).toString(16).padStart(2, '0')).join('');
      }

      if (!unsignedBlockHex) {
        throw new Error('Wallet did not return unsigned block bytes.');
      }

      const declarationPayload = {
        unsignedBlock: unsignedBlockHex,
        blockHash: typeof unsignedBlockRecord.hash === 'string' ? (unsignedBlockRecord.hash as string) : null,
        metadata: {
          type: 'atomic_swap_declaration',
          version: '1.0',
          taker: {
            address: publicKey,
            receives: {
              amount: makerAmount,
              decimals: makerDecimals,
              token: makerTokenAddress,
              from: storageAccountAddress,
            },
            sends: {
              amount: takerAmount,
              decimals: takerDecimals,
              token: takerTokenAddress,
              to: selectedOrder.maker.id,
            },
          },
          terms: {
            atomic: true,
            conditional: true,
            expiry: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          },
          metadata: {
            orderId: selectedOrder.id,
            pair: selectedOrder.pair,
            side: selectedOrder.side,
            price: selectedOrder.price,
            timestamp: Date.now(),
          },
        },
      };

      await declareIntention(selectedOrder.id, {
        takerAddress: publicKey,
        fillAmount,
        unsignedAtomicSwapBlock: JSON.stringify(declarationPayload),
      });

      setHasActiveDeclaration(true);
      setDeclarationStatus('pending');
      setSuccessMessage('Atomic swap declaration sent! Maker will review and sign the transaction...');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to build atomic swap transaction');
    } finally {
      setIsDeclaring(false);
    }
  }, [
    escrowInsights.lockedAmount,
    fillAmount,
    getTokenMetadata,
    isConnected,
    makerSymbolDisplay,
    publicKey,
    selectedOrder,
    userClient,
  ]);
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

  const showPairRecommendation = recommendedPair && recommendedPair !== pair && onPairChange;

  const content = (
    <>
  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 className="text-base font-semibold text-foreground">RFQ Taker</h2>
      <p className="text-[11px] text-muted">Live quotes</p>
    </div>
    <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted">
      <span className="font-medium text-foreground/80">Markets</span>
      {availablePairs.map((candidate) => (
        <button
          key={candidate}
          type="button"
          onClick={() => onPairChange?.(candidate)}
          className={`rounded-full px-2 py-1 transition-colors ${
            candidate === pair ? 'bg-accent/20 text-foreground' : 'bg-surface-strong text-muted hover:text-foreground'
          }`}
        >
          {candidate}
        </button>
      ))}
    </div>
  </div>
  {showPairRecommendation && orders.length === 0 && (
    <div className="rounded-md border border-dashed border-accent/40 bg-accent/10 p-3 text-xs text-accent">
      No quotes for <strong>{pair}</strong> yet. Try
      <button
        type="button"
        onClick={() => onPairChange?.(recommendedPair!)}
        className="ml-1 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-accent/90"
      >
        {recommendedPair}
      </button>
    </div>
  )}
  {!hideInternalTabs && (
  <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-hairline bg-surface/95 backdrop-blur">
    <div className="flex items-center gap-0 px-4">
      <button
        type="button"
        onClick={() => onModeChange('rfq_taker')}
        className={`relative px-4 py-3 text-sm font-medium transition-colors ${
          mode === 'rfq_taker' ? 'text-accent' : 'text-muted hover:text-foreground'
        }`}
      >
        RFQ Taker
        {mode === 'rfq_taker' && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
        )}
      </button>
      <button
        type="button"
        onClick={() => onModeChange('rfq_maker')}
        className={`relative px-4 py-3 text-sm font-medium transition-colors ${
          mode === 'rfq_maker' ? 'text-accent' : 'text-muted hover:text-foreground'
        }`}
      >
        RFQ Maker
        {mode === 'rfq_maker' && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
        )}
      </button>
      <button
        type="button"
        onClick={() => onModeChange('rfq_orders')}
        className={`relative px-4 py-3 text-sm font-medium transition-colors ${
          mode === 'rfq_orders' ? 'text-accent' : 'text-muted hover:text-foreground'
        }`}
      >
        RFQ Orders
        {mode === 'rfq_orders' && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
        )}
      </button>
    </div>
  </div>
  )}

  {mode === 'rfq_orders' && !hideInternalTabs ? (
    <RFQOrdersPanel mode={mode} onModeChange={onModeChange} />
  ) : selectedOrder ? (
  <div className="flex flex-col gap-4">
  <div className="flex flex-col gap-1">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{pairLabel}</h3>
        <p className="text-xs text-muted">Maker {selectedOrder.maker.displayName} · Rep {selectedOrder.maker.reputationScore}</p>
      </div>
      <button
        type="button"
        onClick={handleCopyUnsignedBlock}
        className="inline-flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:border-accent hover:text-foreground"
      >
        <ClipboardCopy className="h-3 w-3" />
        {copied ? 'Copied' : 'Escrow'}
      </button>
    </div>
  </div>

  <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface-strong/80 p-3 text-xs text-muted">
  <div>
  <p className="font-medium text-foreground">Price</p>
  <p>{`1 ${makerSymbolDisplay} = ${formatNumber(selectedOrder.price, selectedOrder.price > 10 ? 2 : 6)} ${takerSymbolDisplay}`}</p>
  </div>
  <div>
  <p className="font-medium text-foreground">Size</p>
  <p>{formatToken(selectedOrder.size)} {makerSymbolDisplay}</p>
  </div>
  {selectedOrder.minFill && (
  <div>
  <p className="font-medium text-foreground">Min fill</p>
  <p>{formatToken(selectedOrder.minFill)} {makerSymbolDisplay}</p>
  </div>
  )}
  <div>
  <p className="font-medium text-foreground">Expiry</p>
  <p>{new Date(selectedOrder.expiry).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
  </div>
  </div>

  <div className="space-y-3 rounded-lg border border-hairline bg-surface px-3 py-3 text-xs">
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
  <p className="rounded bg-surface-strong px-3 py-2 text-[11px] text-foreground border border-hairline">{escrowError}</p>
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
  ? `${formatToken(escrowInsights.lockedAmount)} ${makerSymbolDisplay}`
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
  <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs">
    <div className="font-semibold text-accent mb-1">Swap preview</div>
    <div className="space-y-1 text-foreground">
      <div>Storage → you: {formatToken(fillAmount)} {makerSymbolDisplay}</div>
      <div>You → maker: {formatToken(fillAmount * selectedOrder.price)} {takerSymbolDisplay}</div>
      <div>Rate: 1 {makerSymbolDisplay} = {formatNumber(selectedOrder.price, selectedOrder.price > 10 ? 2 : 6)} {takerSymbolDisplay}</div>
    </div>
    <p className="mt-2 text-accent/70">Both transfers publish together. If either fails, the swap cancels.</p>
  </div>
  )}

  <label className="space-y-1">
    <span className="text-xs font-medium text-muted">Fill amount</span>
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
    <span className="text-[11px] text-muted">Token: {makerSymbolDisplay}</span>
  </label>

  {settlementPreview && (
  <div className="rounded-lg border border-hairline bg-surface-strong/80 p-3 text-xs text-muted">
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
  <div className="flex items-start gap-2 rounded-lg border border-hairline bg-surface-strong p-3 text-xs text-foreground">
  <AlertTriangle className="mt-0.5 h-4 w-4" />
  <span>{localError}</span>
  </div>
  )}

  {successMessage && (
  <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs text-accent">
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
          Sending…
        </>
      ) : (
        'Declare intention'
      )}
    </button>
  ) : declarationStatus === 'approved' ? (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
      <CheckCircle2 className="h-4 w-4" />
      Swap executed
    </div>
  ) : (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-hairline bg-surface px-4 py-3 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      Waiting on maker…
    </div>
  )}

  <p className="text-[11px] text-muted">
    {!hasActiveDeclaration
      ? 'Submit your fill request. The maker reviews and signs before the swap settles.'
      : declarationStatus === 'approved'
        ? 'Maker approved your swap and published the transaction.'
        : 'Awaiting maker approval. We will refresh the status automatically.'}
  </p>
  </div>
  ) : (
  <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed border-hairline bg-surface px-4 py-6 text-center">
  <Info className="h-6 w-6 text-muted" />
  <div>
  <p className="text-sm font-medium text-foreground">Select a quote to get started</p>
  <p className="text-xs text-muted">Browse live RFQs in the order book and choose one to review settlement details.</p>
  </div>
  </div>
  )}
  </>
  );

  if (hideInternalTabs) {
    return content;
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded-lg border border-hairline bg-surface p-4">
      {content}
    </div>
  );
}

export default RFQTakerPanel;



