'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRFQContext } from '@/app/contexts/RFQContext';
import { useWallet } from '@/app/contexts/WalletContext';
import { fetchDeclarations } from '@/app/lib/rfq-api';
import type { RFQDeclaration, RFQOrder } from '@/app/types/rfq';

interface RFQOrdersPanelProps {
  mode: 'rfq_taker' | 'rfq_maker' | 'rfq_orders';
  onModeChange: (mode: 'rfq_taker' | 'rfq_maker' | 'rfq_orders') => void;
  hideInternalTabs?: boolean;
}

type DeclarationMap = Record<string, RFQDeclaration[]>;

export function RFQOrdersPanel({ mode, onModeChange, hideInternalTabs }: RFQOrdersPanelProps): React.JSX.Element {
  const { publicKey } = useWallet();
  const { orders, selectOrder, selectedOrder, refreshOrders } = useRFQContext();
  const [isLoadingDeclarations, setIsLoadingDeclarations] = useState(false);
  const [declarationMap, setDeclarationMap] = useState<DeclarationMap>({});

  const makerOrders = useMemo(() => {
    if (!publicKey) {
      return [] as RFQOrder[];
    }
    return orders.filter((order) => order.maker.id === publicKey);
  }, [orders, publicKey]);

  const activeQuotes = useMemo(
    () => makerOrders.filter((order) => order.status === 'open'),
    [makerOrders],
  );

  const pendingFillQuotes = useMemo(() => {
    return makerOrders.filter((order) => {
      if (order.status === 'pending_fill') {
        return true;
      }
      const declarations = declarationMap[order.id] ?? [];
      return declarations.some((declaration) => declaration.status === 'pending');
    });
  }, [declarationMap, makerOrders]);

  const handleRefreshDeclarations = useCallback(async () => {
    if (!makerOrders.length) {
      setDeclarationMap({});
      return;
    }

    setIsLoadingDeclarations(true);
    try {
      const entries = await Promise.all(
        makerOrders.map(async (order) => {
          try {
            const declarations = await fetchDeclarations(order.id);
            return { orderId: order.id, declarations };
          } catch (error) {
            console.warn('[RFQOrdersPanel] Failed to load declarations for order', order.id, error);
            return { orderId: order.id, declarations: [] as RFQDeclaration[] };
          }
        }),
      );

      const next: DeclarationMap = {};
      for (const entry of entries) {
        next[entry.orderId] = entry.declarations;
      }
      setDeclarationMap(next);
    } finally {
      setIsLoadingDeclarations(false);
    }
  }, [makerOrders]);

  useEffect(() => {
    void handleRefreshDeclarations();
  }, [handleRefreshDeclarations]);

  const renderOrderCard = useCallback(
    (order: RFQOrder) => {
      const isSelected = selectedOrder?.id === order.id;
      const declarations = declarationMap[order.id] ?? [];
      const pendingDeclarations = declarations.filter((declaration) => declaration.status === 'pending');

      return (
        <button
          key={order.id}
          type="button"
          onClick={() => selectOrder(order.id)}
          className={`w-full rounded-lg border px-4 py-3 text-left transition-all ${
            isSelected
              ? 'border-accent bg-accent/10 shadow-lg shadow-accent/20'
              : 'border-hairline bg-surface hover:border-accent/60 hover:bg-surface-strong'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span>{order.pair}</span>
                <span className="text-xs font-medium text-muted">{order.side === 'sell' ? 'Maker sells' : 'Maker buys'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span>
                  Size{' '}
                  <strong className="text-foreground">
                    {order.size.toLocaleString('en-US', { maximumFractionDigits: order.size > 1 ? 2 : 4 })}
                  </strong>
                </span>
                {order.minFill && (
                  <span>
                    Min{' '}
                    <strong className="text-foreground">
                      {order.minFill.toLocaleString('en-US', { maximumFractionDigits: order.minFill > 1 ? 2 : 4 })}
                    </strong>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold bg-surface-strong text-muted">
                  {order.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                <span>Price {order.price.toLocaleString('en-US', { maximumFractionDigits: order.price > 1 ? 2 : 4 })}</span>
                <span>
                  Expires {new Date(order.expiry).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            {pendingDeclarations.length > 0 && (
              <span className="rounded-full bg-accent/15 px-3 py-1 text-[11px] font-semibold text-accent">
                {pendingDeclarations.length} pending
              </span>
            )}
          </div>
          {pendingDeclarations.length > 0 && (
            <div className="mt-3 space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs">
              <div className="flex items-center justify-between text-accent">
                <span className="font-semibold">Pending declarations</span>
                <span>{pendingDeclarations.length}</span>
              </div>
              <div className="space-y-1 text-muted">
                {pendingDeclarations.map((declaration) => (
                  <div key={declaration.id} className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-foreground">
                      {declaration.takerAddress.slice(0, 6)}…{declaration.takerAddress.slice(-4)}
                    </span>
                    <span>
                      {declaration.fillAmount.toLocaleString('en-US', {
                        maximumFractionDigits: declaration.fillAmount > 1 ? 2 : 4,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </button>
      );
    },
    [declarationMap, selectOrder, selectedOrder],
  );

  const header = hideInternalTabs ? null : (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-foreground">RFQ Orders</h2>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onModeChange('rfq_taker')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            mode === 'rfq_taker' ? 'bg-surface-strong text-foreground' : 'text-muted hover:text-foreground'
          }`}
        >
          RFQ Taker
        </button>
        <button
          type="button"
          onClick={() => onModeChange('rfq_maker')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            mode === 'rfq_maker' ? 'bg-surface-strong text-foreground' : 'text-muted hover:text-foreground'
          }`}
        >
          RFQ Maker
        </button>
        <button
          type="button"
          onClick={() => onModeChange('rfq_orders')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            mode === 'rfq_orders' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
          }`}
        >
          RFQ Orders
        </button>
      </div>
    </div>
  );

  const body = (
    <>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>Manage your active quotes and declarations.</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshOrders()}
            className="rounded-full border border-hairline px-3 py-1 font-medium text-muted transition-colors hover:border-accent hover:text-foreground"
          >
            Refresh Orders
          </button>
          <button
            type="button"
            onClick={() => void handleRefreshDeclarations()}
            className="rounded-full border border-hairline px-3 py-1 font-medium text-muted transition-colors hover:border-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoadingDeclarations}
          >
            {isLoadingDeclarations ? 'Loading…' : 'Refresh Declarations'}
          </button>
        </div>
      </div>

      <div className="space-y-4 overflow-y-auto pr-1">
        <section className="space-y-2">
          <header className="flex items-center justify-between text-xs text-muted">
            <span className="font-medium text-foreground">Active quotes</span>
            <span>{activeQuotes.length}</span>
          </header>
          {activeQuotes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-hairline bg-surface px-4 py-6 text-center text-xs text-muted">
              You have no active quotes. Publish a maker RFQ to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {activeQuotes.map(renderOrderCard)}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <header className="flex items-center justify-between text-xs text-muted">
            <span className="font-medium text-foreground">Pending declarations / fills</span>
            <span>{pendingFillQuotes.length}</span>
          </header>
          {pendingFillQuotes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-hairline bg-surface px-4 py-6 text-center text-xs text-muted">
              No pending declarations right now. RFQ takers will appear here when they signal fills.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingFillQuotes.map(renderOrderCard)}
            </div>
          )}
      </section>
    </div>
    </>
  );

  if (hideInternalTabs) {
    return <div className="flex h-full flex-col gap-4">{body}</div>;
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded-lg border border-hairline bg-surface p-4">
      {header}
      {body}
    </div>
  );
}
