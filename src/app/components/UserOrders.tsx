'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';

import type { UserOrderEntry } from '@/app/types/trading';

interface UserOrdersProps {
  orders?: UserOrderEntry[];
  onCancelOrder?: (orderId: string) => Promise<void> | void;
}

type TabKey = 'open' | 'history';

const OPEN_STATUSES = new Set(['resting', 'partially_filled']);
const HISTORY_STATUSES = new Set(['filled', 'canceled', 'expired', 'rejected']);

export function UserOrders({ orders = [], onCancelOrder }: UserOrdersProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabKey>('open');
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { openOrders, historyOrders } = useMemo(() => {
    const open = orders.filter((order) => OPEN_STATUSES.has(order.status));
    const history = orders.filter((order) => HISTORY_STATUSES.has(order.status));
    return { openOrders: open, historyOrders: history };
  }, [orders]);

  const visibleOrders = activeTab === 'open' ? openOrders : historyOrders;

  const handleCancel = async (orderId: string) => {
    if (!onCancelOrder) return;
    setPendingOrderId(orderId);
    setError(null);
    try {
      await onCancelOrder(orderId);
    } catch (cancelError) {
      const message =
        cancelError instanceof Error ? cancelError.message : 'Failed to cancel order';
      setError(message);
    } finally {
      setPendingOrderId(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex gap-2 border-b border-hairline">
        <button
          type="button"
          onClick={() => setActiveTab('open')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'open'
              ? 'border-b-2 border-accent text-accent'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Open Orders ({openOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'border-b-2 border-accent text-accent'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Order History
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex-1 space-y-2 overflow-y-auto">
        {visibleOrders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            No {activeTab === 'open' ? 'active' : 'historical'} orders.
          </p>
        ) : (
          visibleOrders.map((order) => {
            const total = order.price * order.quantity;
            const sideColor = order.side === 'buy' ? 'text-green-400' : 'text-red-400';
            const filledPercent = Math.min(100, (order.filledQuantity / order.quantity) * 100);
            const isPending = pendingOrderId === order.id;

            return (
              <div
                key={order.id}
                className="flex items-start justify-between rounded-lg bg-surface px-3 py-3 transition-colors hover:bg-surface-strong"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase ${sideColor}`}>
                      {order.side}
                    </span>
                    <span className="text-sm text-foreground">{order.market}</span>
                    <span className="text-xs text-muted">{order.status}</span>
                  </div>
                  <div className="text-xs text-muted">
                    <span>Price {order.price.toFixed(6)}</span>
                    <span className="mx-2">•</span>
                    <span>Qty {order.quantity.toFixed(4)}</span>
                    <span className="mx-2">•</span>
                    <span>Total {total.toFixed(2)}</span>
                  </div>
                  {order.filledQuantity > 0 && order.quantity > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] uppercase text-muted">
                        <span>Filled</span>
                        <span>{filledPercent.toFixed(0)}%</span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-surface-strong">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${filledPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {activeTab === 'open' && onCancelOrder && (
                  <button
                    type="button"
                    onClick={() => handleCancel(order.id)}
                    className="rounded p-2 text-muted transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isPending}
                    aria-label={`Cancel order ${order.id}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default UserOrders;
