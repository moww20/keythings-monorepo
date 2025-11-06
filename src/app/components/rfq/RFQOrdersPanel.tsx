'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, XCircle, Zap } from 'lucide-react';

import { useRFQContext } from '@/app/contexts/RFQContext';
import { useWallet } from '@/app/contexts/WalletContext';
import { approveDeclaration, fetchDeclarations } from '@/app/lib/rfq-api';
import type { RFQDeclaration, RFQOrder } from '@/app/types/rfq';

interface RFQOrdersPanelProps {
  mode: 'rfq_taker' | 'rfq_maker' | 'rfq_orders';
  onModeChange: (mode: 'rfq_taker' | 'rfq_maker' | 'rfq_orders') => void;
  hideInternalTabs?: boolean;
}

type DeclarationMap = Record<string, RFQDeclaration[]>;

export function RFQOrdersPanel({ mode, onModeChange, hideInternalTabs }: RFQOrdersPanelProps): React.JSX.Element {
  const { publicKey, signAtomicSwapDeclaration } = useWallet();
  const { orders, selectOrder, selectedOrder, refreshOrders, takerDeclaredOrderIds, registerTakerDeclaration, cancelQuote } = useRFQContext();
  const [isLoadingDeclarations, setIsLoadingDeclarations] = useState(false);
  const [declarationMap, setDeclarationMap] = useState<DeclarationMap>({});
  const [respondingDeclaration, setRespondingDeclaration] = useState<string | null>(null);

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

  const takerOrders = useMemo(() => {
    if (!publicKey) {
      return [] as RFQOrder[];
    }
    const declaredIds = new Set(takerDeclaredOrderIds);
    return orders.filter((order) => {
      if (order.maker.id === publicKey) {
        return false;
      }
      return declaredIds.has(order.id) || order.takerAddress === publicKey;
    });
  }, [orders, publicKey, takerDeclaredOrderIds]);

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
  }, [makerOrders, setDeclarationMap]);

  useEffect(() => {
    void handleRefreshDeclarations();
  }, [handleRefreshDeclarations]);

  const handleDeclarationDecision = useCallback(
    async (orderId: string, declarationId: string, approve: boolean) => {
      setRespondingDeclaration(declarationId);
      try {
        let makerBlockHash: string | null | undefined;
        let makerSignedBlock: string | null | undefined;

        if (approve) {
          const declarations = declarationMap[orderId] ?? [];
          const targetDeclaration = declarations.find((entry) => entry.id === declarationId);
          if (!targetDeclaration) {
            throw new Error('Declaration not found locally. Refresh and retry.');
          }

          const rawPayload = targetDeclaration.unsignedAtomicSwapBlock;
          let unsignedBlockHex: string | undefined;
          let unsignedBlockJson: unknown;

          if (rawPayload) {
            try {
              const parsed = JSON.parse(rawPayload);
              if (parsed && typeof parsed === 'object' && 'unsignedBlock' in parsed) {
                unsignedBlockHex = (parsed as { unsignedBlock?: string }).unsignedBlock ?? undefined;
                unsignedBlockJson = parsed;
              } else {
                unsignedBlockJson = parsed;
              }
            } catch (error) {

              unsignedBlockJson = rawPayload;
            }
          }

          if (signAtomicSwapDeclaration && (unsignedBlockHex || unsignedBlockJson)) {
            try {
              const signingResult = await signAtomicSwapDeclaration({
                unsignedBlockHex,
                unsignedBlockJson,
              });
              makerBlockHash = signingResult.blockHash ?? null;
              makerSignedBlock = signingResult.signedBlock ?? null;
            } catch (error) {
              console.error('[RFQOrdersPanel] Wallet signing failed, falling back to backend approval', error);
            }
          }
        }

        const response = await approveDeclaration(orderId, {
          declarationId,
          approved: approve,
          makerBlockHash,
          makerSignedBlock,
        });

        if (
          approve &&
          response?.declaration?.takerAddress &&
          publicKey &&
          response.declaration.takerAddress === publicKey
        ) {
          registerTakerDeclaration(orderId);
        }
        await handleRefreshDeclarations();
      } finally {
        setRespondingDeclaration(null);
      }
    },
    [
      declarationMap,
      handleRefreshDeclarations,
      publicKey,
      registerTakerDeclaration,
      signAtomicSwapDeclaration,
    ],
  );

  const renderOrderCard = useCallback(
    (order: RFQOrder, viewingRole: 'maker' | 'taker' = 'maker') => {
      const isSelected = selectedOrder?.id === order.id;
      const declarations = declarationMap[order.id] ?? [];
      const pendingDeclarations = declarations.filter((declaration) => declaration.status === 'pending');
      const approvedDeclarations = declarations.filter((declaration) => declaration.status === 'approved');
      const isMakerView = viewingRole === 'maker';

      return (
        <div
          key={order.id}
          role="button"
          tabIndex={0}
          onClick={() => selectOrder(order.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              selectOrder(order.id);
            }
          }}
          className={`w-full rounded-lg border px-4 py-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
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
            {isMakerView ? (
              <>
                {pendingDeclarations.length > 0 && (
                  <div className="flex flex-col items-end gap-1 text-[11px]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 font-semibold text-accent">
                      <Zap className="h-3 w-3" />
                      Declaration pending
                    </span>
                    <span className="text-muted">Review to sign or reject.</span>
                  </div>
                )}
                {pendingDeclarations.length === 0 && approvedDeclarations.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--accent-muted,rgba(106,168,255,0.15))] px-3 py-1 text-[11px] font-semibold text-accent">
                    <CheckCircle2 className="h-3 w-3" />
                    Declaration approved
                  </span>
                )}
                {pendingDeclarations.length === 0 && order.status === 'open' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void cancelQuote(order.id);
                      }}
                      className="rounded-full border border-hairline px-3 py-1 text-[11px] font-medium text-muted transition-colors hover:border-accent hover:text-foreground"
                    >
                      Cancel quote
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-end gap-1 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-strong px-3 py-1 font-semibold text-muted">
                  My declaration
                </span>
                <span className="text-muted">
                  {order.status === 'pending_fill' ? 'Awaiting maker fill' : order.status.replace('_', ' ')}
                </span>
              </div>
            )}
          </div>
          {isMakerView && pendingDeclarations.length > 0 && (
            <div className="mt-3 space-y-2 rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs">
              <div className="flex items-center justify-between text-accent">
                <span className="font-semibold">Pending declarations</span>
                <span>{pendingDeclarations.length}</span>
              </div>
              <div className="space-y-2 text-muted">
                {pendingDeclarations.map((declaration) => {
                  const isResponding = respondingDeclaration === declaration.id;
                  return (
                    <div key={declaration.id} className="rounded-lg bg-surface px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            <span className="font-semibold">
                              {declaration.fillAmount.toLocaleString('en-US', {
                                maximumFractionDigits: declaration.fillAmount > 1 ? 2 : 6,
                              })}
                            </span>
                            <span className="text-[11px] text-muted">
                              {declaration.takerAddress.slice(0, 6)}…{declaration.takerAddress.slice(-4)}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted">
                            Submitted {new Date(declaration.declaredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeclarationDecision(order.id, declaration.id, true);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleDeclarationDecision(order.id, declaration.id, true);
                              }
                            }}
                            className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                              isResponding ? 'bg-accent/40 text-white opacity-70' : 'bg-accent text-white hover:bg-accent/90'
                            }`}
                            aria-pressed={isResponding}
                          >
                            {isResponding ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Approve
                          </div>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeclarationDecision(order.id, declaration.id, false);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleDeclarationDecision(order.id, declaration.id, false);
                              }
                            }}
                            className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                              isResponding ? 'bg-surface-strong text-muted opacity-70' : 'bg-surface text-muted hover:text-foreground'
                            }`}
                            aria-pressed={isResponding}
                          >
                            <XCircle className="h-3 w-3" />
                            Reject
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    },
    [
      cancelQuote,
      declarationMap,
      respondingDeclaration,
      selectOrder,
      selectedOrder,
      handleDeclarationDecision,
    ],
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
              {activeQuotes.map((order) => renderOrderCard(order, 'maker'))}
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
              {pendingFillQuotes.map((order) => renderOrderCard(order, 'maker'))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <header className="flex items-center justify-between text-xs text-muted">
            <span className="font-medium text-foreground">My declarations</span>
            <span>{takerOrders.length}</span>
          </header>
          {takerOrders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-hairline bg-surface px-4 py-6 text-center text-xs text-muted">
              Your declared orders will appear here.
            </div>
          ) : (
            <div className="space-y-3">
              {takerOrders.map((order) => renderOrderCard(order, 'taker'))}
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
