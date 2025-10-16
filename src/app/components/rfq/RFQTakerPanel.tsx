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
  const { isConnected, publicKey } = useWallet();
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleSubmit = useCallback(async () => {
    if (!selectedOrder || !fillAmount) {
      setLocalError('Select a quote and enter a fill size first.');
      return;
    }

    if (!isConnected || !publicKey) {
      setLocalError('Connect your wallet to sign RFQ fills.');
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

    await requestFill(selectedOrder.id, fillAmount, publicKey ?? undefined);
  }, [escrowInsights.lockedAmount, fillAmount, isConnected, publicKey, requestFill, selectedOrder]);

  if (!selectedOrder) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-hairline bg-surface px-4 py-6 text-center">
        <Info className="h-6 w-6 text-muted" />
        <div>
          <p className="text-sm font-medium text-foreground">Select a quote to get started</p>
          <p className="text-xs text-muted">Browse live RFQs in the order book and choose one to review settlement details.</p>
        </div>
      </div>
    );
  }

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

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!isConnected || isFilling}
        className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          isConnected ? 'bg-accent hover:bg-accent/90' : 'bg-muted'
        }`}
      >
        {isFilling ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing...
          </>
        ) : (
          'Sign & Fill RFQ'
        )}
      </button>

      <p className="text-[11px] text-muted">
        Keeta co-signing is automatic for this maker. After you sign, their auto-signer confirms availability and finalizes the swap.
      </p>
    </div>
  );
}

export default RFQTakerPanel;

