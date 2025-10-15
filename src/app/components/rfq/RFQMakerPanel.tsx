'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCopy, Loader2, Zap } from 'lucide-react';

import { useRFQContext } from '@/app/contexts/RFQContext';
import type { RFQQuoteDraft, RFQQuoteSubmission } from '@/app/types/rfq';
import { useWallet } from '@/app/contexts/WalletContext';

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

export function RFQMakerPanel(): React.JSX.Element {
  const { pair, createQuote, cancelQuote, selectedOrder, orders } = useRFQContext();
  const { publicKey, isConnected } = useWallet();
  const [draft, setDraft] = useState<MakerDraftState>(DEFAULT_DRAFT);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
  }, [pair]);

  const makerProfile = useMemo(
    () => ({
      id: publicKey ?? 'maker-local',
      displayName: publicKey ? `You (${trimPubkey(publicKey)})` : 'Your Desk',
      verified: Boolean(publicKey),
      reputationScore: 82,
      autoSignSlaMs: 380,
      fillsCompleted: 214,
      failureRate: 0.7,
      allowlistLabel: draft.allowlistLabel || undefined,
    }),
    [draft.allowlistLabel, publicKey],
  );

  const selectedMakerOrder = useMemo(() => orders.find((order) => order.id === selectedOrder?.id), [orders, selectedOrder]);

  const handleDraftChange = useCallback((patch: Partial<MakerDraftState>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
  }, []);

  const handleCopyBlock = useCallback(() => {
    if (!selectedMakerOrder) {
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(selectedMakerOrder.unsignedBlock);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  }, [selectedMakerOrder]);

  const handlePublish = useCallback(async () => {
    if (!isConnected || !publicKey) {
      setError('Connect your market maker wallet before publishing quotes.');
      return;
    }

    if (!draft.price || Number.isNaN(Number.parseFloat(draft.price))) {
      setError('Enter a valid price.');
      return;
    }

    if (!draft.size || Number.isNaN(Number.parseFloat(draft.size))) {
      setError('Enter a valid size.');
      return;
    }

    if (draft.minFill && Number.isNaN(Number.parseFloat(draft.minFill))) {
      setError('Min fill must be numeric.');
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

    setIsPublishing(true);
    setError(null);
    setSuccess(null);

    try {
      const order = await createQuote(submission);
      setSuccess(`Quote ${order.id} published. Auto-sign SLA ${makerProfile.autoSignSlaMs} ms.`);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Failed to publish RFQ.');
    } finally {
      setIsPublishing(false);
    }
  }, [createQuote, draft, isConnected, makerProfile, pair, publicKey]);

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
          <p className="text-xs text-muted">Post partially signed quotes that auto-fill via maker webhook.</p>
        </div>
        <div className="rounded-full bg-surface-strong px-3 py-1 text-[11px] font-medium text-muted">
          Maker profile · {trimPubkey(publicKey)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <label className="space-y-1">
          <span className="text-muted">Side</span>
          <select
            className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm"
            value={draft.side}
            onChange={(event) => handleDraftChange({ side: event.target.value as MakerDraftState['side'] })}
          >
            <option value="sell">Sell (quote asset)</option>
            <option value="buy">Buy (base asset)</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-muted">Price</span>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm"
            value={draft.price}
            onChange={(event) => handleDraftChange({ price: event.target.value })}
            placeholder="0.00"
          />
        </label>
        <label className="space-y-1">
          <span className="text-muted">Size</span>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm"
            value={draft.size}
            onChange={(event) => handleDraftChange({ size: event.target.value })}
            placeholder="0.00"
          />
        </label>
        <label className="space-y-1">
          <span className="text-muted">Min fill (optional)</span>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm"
            value={draft.minFill}
            onChange={(event) => handleDraftChange({ minFill: event.target.value })}
            placeholder="0.00"
          />
        </label>
        <label className="space-y-1">
          <span className="text-muted">Expiry</span>
          <select
            className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm"
            value={draft.expiryPreset}
            onChange={(event) => handleDraftChange({ expiryPreset: event.target.value as MakerDraftState['expiryPreset'] })}
          >
            {EXPIRY_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-muted">Auto-sign profile ID</span>
          <input
            type="text"
            className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm"
            value={draft.autoSignProfileId}
            onChange={(event) => handleDraftChange({ autoSignProfileId: event.target.value })}
            placeholder="default"
          />
        </label>
        <label className="col-span-2 space-y-1">
          <span className="text-muted">Taker allowlist label (optional)</span>
          <input
            type="text"
            className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm"
            value={draft.allowlistLabel}
            onChange={(event) => handleDraftChange({ allowlistLabel: event.target.value })}
            placeholder="Open access"
          />
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-xs text-green-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4" />
          <span>{success}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handlePublish}
        disabled={!isConnected || isPublishing}
        className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          isConnected ? 'bg-accent hover:bg-accent/90' : 'bg-muted'
        }`}
      >
        {isPublishing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Publishing...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            Publish RFQ Quote
          </>
        )}
      </button>

      <div className="space-y-3 rounded-lg border border-hairline bg-surface-strong p-3 text-xs text-muted">
        <div className="flex items-center justify-between">
          <span>Latest unsigned block preview</span>
          <button
            type="button"
            onClick={handleCopyBlock}
            className="inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-1 text-[11px] font-medium text-muted transition-colors hover:border-accent hover:text-foreground"
            disabled={!selectedMakerOrder}
          >
            <ClipboardCopy className="h-3 w-3" />
            {copied ? 'Copied!' : 'Copy bytes'}
          </button>
        </div>
        <pre className="max-h-32 overflow-y-auto rounded bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-foreground/80">
{selectedMakerOrder ? selectedMakerOrder.unsignedBlock : 'Publish a quote to generate an unsigned block preview.'}
        </pre>
        {selectedMakerOrder && (
          <button
            type="button"
            onClick={handleCancelSelected}
            className="text-[11px] font-medium text-red-300 underline-offset-2 hover:underline"
          >
            Cancel selected quote
          </button>
        )}
      </div>
    </div>
  );
}

export default RFQMakerPanel;

