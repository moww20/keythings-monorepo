'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  cancelRfqOrder,
  fetchRfqMakers,
  fetchRfqOrder,
  fetchRfqOrders,
  submitRfqFill,
} from '@/app/lib/rfq-api';
import type {
  RFQFillRequestResult,
  RFQMakerMeta,
  RFQOrder,
  RFQOrderBookBuckets,
  RFQQuoteSubmission,
} from '@/app/types/rfq';
import type { OrderSide } from '@/app/types/trading';

interface RFQContextValue {
  pair: string;
  orders: RFQOrder[];
  makers: RFQMakerMeta[];
  buckets: RFQOrderBookBuckets;
  selectedOrder?: RFQOrder;
  selectOrder: (orderId: string | null) => void;
  fillAmount?: number;
  setFillAmount: (value?: number) => void;
  requestFill: (orderId: string, amount: number, takerAddress?: string) => Promise<RFQFillRequestResult>;
  createQuote: (submission: RFQQuoteSubmission) => Promise<RFQOrder>;
  cancelQuote: (orderId: string) => Promise<void>;
  refreshOrders: () => Promise<void>;
  isFilling: boolean;
  lastFillResult?: RFQFillRequestResult;
}

const RFQContext = createContext<RFQContextValue | undefined>(undefined);

export function RFQProvider({ pair, children }: { pair: string; children: ReactNode }): React.JSX.Element {
  const [orders, setOrders] = useState<RFQOrder[]>([]);
  const [makers, setMakers] = useState<RFQMakerMeta[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [fillAmount, setFillAmountState] = useState<number | undefined>(undefined);
  const [isFilling, setIsFilling] = useState(false);
  const [lastFillResult, setLastFillResult] = useState<RFQFillRequestResult | undefined>();

  const refreshOrders = useCallback(async () => {
    const [orderList, makerList] = await Promise.all([fetchRfqOrders(pair), fetchRfqMakers()]);
    setOrders(orderList);
    setMakers(makerList);

    if (orderList.length === 0) {
      setSelectedOrderId(null);
      setFillAmountState(undefined);
      return;
    }

    const defaultOrder = orderList.find((order) => order.status === 'open') ?? orderList[0];
    setSelectedOrderId(defaultOrder?.id ?? null);
    setFillAmountState(defaultOrder ? defaultOrder.minFill ?? defaultOrder.size : undefined);
  }, [pair]);

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId),
    [orders, selectedOrderId],
  );

  useEffect(() => {
    if (selectedOrder) {
      setFillAmountState(selectedOrder.minFill ?? selectedOrder.size);
    } else {
      setFillAmountState(undefined);
    }
  }, [selectedOrder]);

  const buckets = useMemo<RFQOrderBookBuckets>(() => {
    return orders.reduce<RFQOrderBookBuckets>(
      (accumulator, order) => {
        accumulator[order.status]?.push(order);
        return accumulator;
      },
      {
        open: [],
        pending_fill: [],
        filled: [],
        expired: [],
      },
    );
  }, [orders]);

  const selectOrder = useCallback((orderId: string | null) => {
    setSelectedOrderId(orderId);
    if (!orderId) {
      setFillAmountState(undefined);
    }
  }, []);

  const setFillAmount = useCallback((value?: number) => {
    setFillAmountState(value && Number.isFinite(value) ? value : undefined);
  }, []);

  const requestFill = useCallback(
    async (orderId: string, amount: number, takerAddress?: string) => {
      const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      setIsFilling(true);
      setLastFillResult(undefined);

      try {
        const result = await submitRfqFill(orderId, {
          taker_amount: amount,
          taker_address: takerAddress,
          auto_publish: true,
        });

        setOrders((previous) => {
          const exists = previous.some((order) => order.id === result.order.id);
          if (exists) {
            return previous.map((order) => (order.id === result.order.id ? result.order : order));
          }
          return [result.order, ...previous];
        });

        setSelectedOrderId(result.order.id);
        setFillAmountState(result.order.minFill ?? result.order.size);

        const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const latency = result.latencyMs || Math.max(0, Math.round(finishedAt - startedAt));
        const normalized: RFQFillRequestResult = { ...result, latencyMs: latency };
        setLastFillResult(normalized);
        return normalized;
      } catch (error) {
        const fallback = await fetchRfqOrder(orderId);
        if (fallback) {
          setOrders((previous) => {
            const exists = previous.some((order) => order.id === fallback.id);
            if (exists) {
              return previous.map((order) => (order.id === fallback.id ? fallback : order));
            }
            return [fallback, ...previous];
          });
        }

        const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const failureResult: RFQFillRequestResult | undefined =
          fallback || selectedOrder
            ? {
                order: fallback ?? (selectedOrder as RFQOrder),
                status: 'rejected',
                latencyMs: Math.max(0, Math.round(finishedAt - startedAt)),
              }
            : undefined;

        if (failureResult) {
          setLastFillResult(failureResult);
        }

        throw error instanceof Error ? error : new Error('Failed to request RFQ fill');
      } finally {
        setIsFilling(false);
      }
    },
    [selectedOrder],
  );

  const createQuote = useCallback(async () => {
    throw new Error(
      'RFQ publishing is now handled by the Keeta maker CLI and automation bots on testnet. Please publish quotes using the maker tooling.',
    );
  }, []);

  const cancelQuote = useCallback(
    async (orderId: string) => {
      await cancelRfqOrder(orderId).catch((error) => {
        console.error('[rfq] Failed to cancel quote', error);
        throw error instanceof Error ? error : new Error('Failed to cancel RFQ quote');
      });

      setOrders((previous) => previous.filter((order) => order.id !== orderId));
      if (selectedOrderId === orderId) {
        setSelectedOrderId(null);
        setFillAmountState(undefined);
      }
    },
    [selectedOrderId],
  );

  const value = useMemo<RFQContextValue>(
    () => ({
      pair,
      orders,
      makers,
      buckets,
      selectedOrder,
      selectOrder,
      fillAmount,
      setFillAmount,
      requestFill,
      createQuote,
      cancelQuote,
      refreshOrders,
      isFilling,
      lastFillResult,
    }),
    [
      pair,
      orders,
      makers,
      buckets,
      selectedOrder,
      selectOrder,
      fillAmount,
      setFillAmount,
      requestFill,
      createQuote,
      cancelQuote,
      refreshOrders,
      isFilling,
      lastFillResult,
    ],
  );

  return <RFQContext.Provider value={value}>{children}</RFQContext.Provider>;
}

export function useRFQContext(): RFQContextValue {
  const context = useContext(RFQContext);

  if (!context) {
    throw new Error('useRFQContext must be used within an RFQProvider');
  }

  return context;
}

export function useMakerProfiles(): RFQMakerMeta[] {
  const { makers } = useRFQContext();
  return makers;
}

export function useMakerProfileById(id: string): RFQMakerMeta | undefined {
  const { makers } = useRFQContext();
  return useMemo(() => makers.find((maker) => maker.id === id), [makers, id]);
}

export function useRfqBucketCount(_pair: string, side: OrderSide): number {
  const { orders } = useRFQContext();
  return useMemo(
    () => orders.filter((order) => order.status === 'open' && order.side === side).length,
    [orders, side],
  );
}
