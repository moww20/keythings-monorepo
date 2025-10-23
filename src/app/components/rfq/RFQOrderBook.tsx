'use client';

import { useMemo, useState } from 'react';
import { Clock3, ShieldAlert, ShieldCheck, Zap } from 'lucide-react';

import { useRFQContext } from '@/app/contexts/RFQContext';
import type { RFQOrder, RFQOrderStatus } from '@/app/types/rfq';
import { getMakerTokenSymbol, getTakerTokenSymbol } from '@/app/lib/token-utils';

const STATUS_LABELS: Record<RFQOrderStatus, string> = {
  open: 'Open',
  pending_fill: 'Pending',
  filled: 'Filled',
  expired: 'Expired',
};

const STATUS_BADGES: Record<RFQOrderStatus, string> = {
  open: 'bg-accent/15 text-accent',
  pending_fill: 'bg-surface-strong text-muted',
  filled: 'bg-surface text-muted',
  expired: 'bg-surface text-muted',
};

function formatRelativeTime(iso: string): string {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = target - now;
  const isPast = diffMs < 0;
  const absolute = Math.abs(diffMs);
  const minutes = Math.floor(absolute / 60000);
  const hours = Math.floor(minutes / 60);

  if (minutes < 1) {
    return isPast ? 'Expired' : '< 1m';
  }

  if (hours < 1) {
    return isPast ? `Expired ${minutes}m ago` : `${minutes}m`;
  }

  const remainingMinutes = minutes % 60;
  const hourLabel = `${hours}h`;
  const minuteLabel = remainingMinutes > 0 ? ` ${remainingMinutes}m` : '';

  return isPast ? `Expired ${hourLabel}${minuteLabel} ago` : `${hourLabel}${minuteLabel}`;
}

function formatNumber(value: number, fractionDigits = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

interface RFQOrderBookProps {
  onPairChange?: (pair: string) => void;
}

export function RFQOrderBook({ onPairChange }: RFQOrderBookProps = {}): React.JSX.Element {
  const { tokenA, tokenB, pair, buckets, selectedOrder, selectOrder, recommendedPair } = useRFQContext();
  const [statusFilter, setStatusFilter] = useState<RFQOrderStatus>('open');

  const orders = useMemo(() => {
    const relevant = buckets[statusFilter] ?? [];
    return relevant.sort((left, right) => right.price - left.price);
  }, [buckets, statusFilter]);

  const headerLabel = useMemo(() => {
    if (tokenA?.symbol && tokenB?.symbol) {
      return `${tokenA.symbol} → ${tokenB.symbol}`;
    }
    return pair || 'Select tokens';
  }, [pair, tokenA, tokenB]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">RFQ Order Book · {headerLabel}</h2>
          <p className="text-xs text-muted">Direct maker quotes updated in real time.</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(['open', 'pending_fill', 'filled', 'expired'] as RFQOrderStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              statusFilter === status
                ? 'bg-surface-strong text-foreground'
                : 'bg-surface text-muted hover:text-foreground'
            }`}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-2">
        {orders.length === 0 && (
          <div className="space-y-3 rounded-lg border border-dashed border-hairline bg-surface px-4 py-6 text-center text-xs text-muted">
            <div>No quotes match your filters yet. Makers can publish fresh RFQs in seconds.</div>
            {recommendedPair && recommendedPair !== pair && onPairChange && (
              <div className="text-accent">
                We detected quotes on <strong>{recommendedPair}</strong>.
                <button
                  type="button"
                  onClick={() => onPairChange(recommendedPair)}
                  className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-white"
                >
                  View {recommendedPair}
                </button>
              </div>
            )}
          </div>
        )}

        {orders.map((order) => {
          const isSelected = order.id === selectedOrder?.id;
          return <RFQOrderCard key={order.id} order={order} isSelected={isSelected} onSelect={selectOrder} />;
        })}
      </div>
    </div>
  );
}

interface RFQOrderCardProps {
  order: RFQOrder;
  isSelected: boolean;
  onSelect: (orderId: string) => void;
}

function RFQOrderCard({ order, isSelected, onSelect }: RFQOrderCardProps): React.JSX.Element {
  const relativeExpiry = formatRelativeTime(order.expiry);
  const isExpired = order.status === 'expired' || relativeExpiry.startsWith('Expired');
  const escrowRef = order.storageAccount ?? order.unsignedBlock;
  const makerSymbol = getMakerTokenSymbol(order.pair, order.side) || 'token';
  const takerSymbol = getTakerTokenSymbol(order.pair, order.side) || 'token';
  const sideLabel = order.side === 'sell'
    ? `Maker sells ${makerSymbol} for ${takerSymbol}`
    : `Maker buys ${makerSymbol} with ${takerSymbol}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(order.id)}
      className={`w-full rounded-lg border px-4 py-3 text-left transition-all ${
        isSelected
          ? 'border-accent bg-accent/10 shadow-lg shadow-accent/20'
          : 'border-hairline bg-surface hover:border-accent/60 hover:bg-surface-strong'
      }`}
      disabled={isExpired}
      aria-pressed={isSelected}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span>${formatNumber(order.price, order.price > 10 ? 2 : 4)}</span>
            <span className="text-xs font-medium text-muted">{sideLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>
              Size <strong className="text-foreground">{formatNumber(order.size, order.size > 1 ? 2 : 4)} {makerSymbol}</strong>
            </span>
            {order.minFill && (
              <span>
                Min <strong className="text-foreground">{formatNumber(order.minFill, order.minFill > 1 ? 2 : 4)} {makerSymbol}</strong>
              </span>
            )}
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${STATUS_BADGES[order.status]}`}>
              <Zap className="h-3 w-3" />
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1">
              {order.maker.verified ? (
                <ShieldCheck className="h-3 w-3 text-accent" />
              ) : (
                <ShieldAlert className="h-3 w-3 text-muted" />
              )}
              {order.maker.displayName} · Rep {order.maker.reputationScore}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3 text-muted" />
              {relativeExpiry}
            </span>
            <span className="inline-flex items-center gap-1 font-mono">
              <Zap className="h-3 w-3 text-accent" />
              {escrowRef ? `${escrowRef.slice(0, 4)}…${escrowRef.slice(-4)}` : 'Escrow pending'}
            </span>
          </div>
        </div>
        {order.allowlisted && order.maker.allowlistLabel && (
          <span className="rounded-full bg-surface-strong px-3 py-1 text-[11px] font-semibold text-muted">
            {order.maker.allowlistLabel}
          </span>
        )}
      </div>
    </button>
  );
}

export default RFQOrderBook;

