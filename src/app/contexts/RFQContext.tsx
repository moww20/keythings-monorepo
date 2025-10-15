'use client';

import { Buffer } from 'buffer';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

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
  buckets: RFQOrderBookBuckets;
  selectedOrder?: RFQOrder;
  selectOrder: (orderId: string | null) => void;
  fillAmount?: number;
  setFillAmount: (value?: number) => void;
  requestFill: (orderId: string, amount: number, takerAddress?: string) => Promise<RFQFillRequestResult>;
  createQuote: (submission: RFQQuoteSubmission) => Promise<RFQOrder>;
  cancelQuote: (orderId: string) => Promise<void>;
  isFilling: boolean;
  lastFillResult?: RFQFillRequestResult;
}

const RFQContext = createContext<RFQContextValue | undefined>(undefined);

const SEED_MAKERS: RFQMakerMeta[] = [
  {
    id: 'maker-aurora',
    displayName: 'Aurora Labs',
    verified: true,
    reputationScore: 94,
    autoSignSlaMs: 320,
    fillsCompleted: 1284,
    failureRate: 0.4,
    allowlistLabel: 'Open Access',
  },
  {
    id: 'maker-harbor',
    displayName: 'HarborFlow MM',
    verified: true,
    reputationScore: 88,
    autoSignSlaMs: 420,
    fillsCompleted: 986,
    failureRate: 1.6,
    allowlistLabel: 'Allowlist: Priority Takers',
  },
  {
    id: 'maker-nimbus',
    displayName: 'Nimbus Desk',
    verified: false,
    reputationScore: 72,
    autoSignSlaMs: 610,
    fillsCompleted: 412,
    failureRate: 4.3,
  },
];

function addMinutesToIso(iso: string, minutes: number): string {
  const base = new Date(iso);
  base.setMinutes(base.getMinutes() + minutes);
  return base.toISOString();
}

function expiryFromPreset(preset: RFQQuoteSubmission['expiryPreset']): number {
  switch (preset) {
    case '5m':
      return 5;
    case '15m':
      return 15;
    case '1h':
      return 60;
    case '4h':
      return 240;
    case '24h':
      return 1440;
    default:
      return 60;
  }
}

function buildUnsignedBlock(submission: RFQQuoteSubmission, orderId: string): string {
  const template = {
    id: orderId,
    pair: submission.pair,
    side: submission.side,
    price: submission.price,
    size: submission.size,
    minFill: submission.minFill ?? '0',
    expiry: submission.expiryPreset,
    maker: submission.maker.displayName,
    takerLeg: {
      send: 'taker_send_placeholder',
      receive: 'taker_receive_placeholder',
    },
    makerLeg: {
      send: 'maker_send_placeholder',
      receive: 'maker_receive_placeholder',
    },
  };

  return typeof window === 'undefined'
    ? Buffer.from(JSON.stringify(template)).toString('base64')
    : window.btoa(JSON.stringify(template));
}

function seedOrders(pair: string): RFQOrder[] {
  const now = new Date();
  const baseIso = now.toISOString();
  const basePrice = pair.startsWith('ETH') ? 3450 : 1.005;
  const makerVariants = SEED_MAKERS;

  return [
    {
      id: `${pair}-rfq-001`,
      pair,
      side: 'sell',
      price: basePrice,
      size: 12,
      minFill: 1,
      expiry: addMinutesToIso(baseIso, 45),
      maker: makerVariants[0]!,
      unsignedBlock: buildUnsignedBlock(
        {
          pair,
          side: 'sell',
          price: basePrice.toFixed(2),
          size: '12',
          minFill: '1',
          expiryPreset: '1h',
          maker: makerVariants[0]!,
        },
        `${pair}-rfq-001`,
      ),
      makerSignature: '0xmaker-signature-aurora',
      allowlisted: true,
      status: 'open',
      createdAt: baseIso,
      updatedAt: baseIso,
    },
    {
      id: `${pair}-rfq-002`,
      pair,
      side: 'buy',
      price: basePrice * 0.999,
      size: 30,
      minFill: 5,
      expiry: addMinutesToIso(baseIso, 25),
      maker: makerVariants[1]!,
      unsignedBlock: buildUnsignedBlock(
        {
          pair,
          side: 'buy',
          price: (basePrice * 0.999).toFixed(2),
          size: '30',
          minFill: '5',
          expiryPreset: '15m',
          maker: makerVariants[1]!,
        },
        `${pair}-rfq-002`,
      ),
      makerSignature: '0xmaker-signature-harbor',
      allowlisted: true,
      status: 'open',
      createdAt: baseIso,
      updatedAt: baseIso,
    },
    {
      id: `${pair}-rfq-003`,
      pair,
      side: 'sell',
      price: basePrice * 1.004,
      size: 4,
      minFill: 2,
      expiry: addMinutesToIso(baseIso, -5),
      maker: makerVariants[2]!,
      unsignedBlock: buildUnsignedBlock(
        {
          pair,
          side: 'sell',
          price: (basePrice * 1.004).toFixed(2),
          size: '4',
          minFill: '2',
          expiryPreset: '15m',
          maker: makerVariants[2]!,
        },
        `${pair}-rfq-003`,
      ),
      makerSignature: '0xmaker-signature-nimbus',
      allowlisted: false,
      status: 'expired',
      createdAt: baseIso,
      updatedAt: baseIso,
    },
  ];
}

interface RFQProviderProps {
  pair: string;
  children: ReactNode;
}

export function RFQProvider({ pair, children }: RFQProviderProps): React.JSX.Element {
  const [orders, setOrders] = useState<RFQOrder[]>(() => seedOrders(pair));
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(orders[0]?.id ?? null);
  const [fillAmount, setFillAmountState] = useState<number | undefined>(orders[0]?.minFill ?? orders[0]?.size);
  const [isFilling, setIsFilling] = useState(false);
  const [lastFillResult, setLastFillResult] = useState<RFQFillRequestResult | undefined>();

  useEffect(() => {
    const seeded = seedOrders(pair);
    setOrders(seeded);
    const defaultOrder = seeded.find((order) => order.status === 'open') ?? seeded[0];
    setSelectedOrderId(defaultOrder?.id ?? null);
    setFillAmountState(defaultOrder?.minFill ?? defaultOrder?.size);
  }, [pair]);

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
        accumulator[order.status].push(order);
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
      const now = Date.now();
      setIsFilling(true);
      setLastFillResult(undefined);

      setOrders((previous) =>
        previous.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: 'pending_fill',
                takerFillAmount: amount,
                takerAddress,
                updatedAt: new Date(now).toISOString(),
              }
            : order,
        ),
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      const expiryDate = selectedOrder ? new Date(selectedOrder.expiry) : undefined;
      const hasExpired = expiryDate ? expiryDate.getTime() < now : false;

      const result = hasExpired
        ? ({
            order: orders.find((order) => order.id === orderId) ?? (selectedOrder as RFQOrder),
            status: 'rejected',
            latencyMs: Date.now() - now,
          } satisfies RFQFillRequestResult)
        : ({
            order: orders.find((order) => order.id === orderId) ?? (selectedOrder as RFQOrder),
            status: 'settled',
            latencyMs: Date.now() - now,
          } satisfies RFQFillRequestResult);

      setOrders((previous) =>
        previous.map((order) => {
          if (order.id !== orderId) {
            return order;
          }

          if (hasExpired) {
            return {
              ...order,
              status: 'expired',
              updatedAt: new Date().toISOString(),
            };
          }

          return {
            ...order,
            status: 'filled',
            updatedAt: new Date().toISOString(),
            takerFillAmount: amount,
            takerAddress,
          };
        }),
      );

      setIsFilling(false);
      setLastFillResult(result);

      return result;
    },
    [orders, selectedOrder],
  );

  const cancelQuote = useCallback(async (orderId: string) => {
    setOrders((previous) => previous.filter((order) => order.id !== orderId));
    if (selectedOrderId === orderId) {
      setSelectedOrderId(null);
    }
  }, [selectedOrderId]);

  const createQuote = useCallback(
    async (submission: RFQQuoteSubmission) => {
      const randomId =
        typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
      const orderId = `${submission.pair}-rfq-${randomId}`;
      const nowIso = new Date().toISOString();
      const unsignedBlock = buildUnsignedBlock(submission, orderId);
      const expiryMinutes = expiryFromPreset(submission.expiryPreset);
      const expiry = addMinutesToIso(nowIso, expiryMinutes);
      const minFillNumber = submission.minFill ? Number.parseFloat(submission.minFill) : undefined;

      const newOrder: RFQOrder = {
        id: orderId,
        pair: submission.pair,
        side: submission.side,
        price: Number.parseFloat(submission.price),
        size: Number.parseFloat(submission.size),
        minFill: minFillNumber,
        expiry,
        maker: submission.maker,
        unsignedBlock,
        makerSignature: `0xmaker-signature-${orderId.slice(-6)}`,
        allowlisted: Boolean(submission.allowlistLabel),
        status: 'open',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setOrders((previous) => [newOrder, ...previous]);
      setSelectedOrderId(orderId);
      setFillAmountState(newOrder.minFill ?? newOrder.size);

      return newOrder;
    },
    [],
  );

  const value = useMemo<RFQContextValue>(
    () => ({
      pair,
      orders,
      buckets,
      selectedOrder,
      selectOrder,
      fillAmount,
      setFillAmount,
      requestFill,
      createQuote,
      cancelQuote,
      isFilling,
      lastFillResult,
    }),
    [
      pair,
      orders,
      buckets,
      selectedOrder,
      selectOrder,
      fillAmount,
      setFillAmount,
      requestFill,
      createQuote,
      cancelQuote,
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

export function useSeedMakers(): RFQMakerMeta[] {
  return SEED_MAKERS;
}

export function useMakerProfileById(id: string): RFQMakerMeta | undefined {
  return useMemo(() => SEED_MAKERS.find((maker) => maker.id === id), [id]);
}

export function useRfqBucketCount(pair: string, side: OrderSide): number {
  const matchingMakerOrders = seedOrders(pair).filter((order) => order.side === side && order.status === 'open');
  return matchingMakerOrders.length;
}

