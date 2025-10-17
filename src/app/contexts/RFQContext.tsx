'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

// Helper function to convert expiry preset to milliseconds
function getExpiryMs(preset: '5m' | '15m' | '1h' | '4h' | '24h'): number {
  const msPerMinute = 60 * 1000;
  switch (preset) {
    case '5m': return 5 * msPerMinute;
    case '15m': return 15 * msPerMinute;
    case '1h': return 60 * msPerMinute;
    case '4h': return 4 * 60 * msPerMinute;
    case '24h': return 24 * 60 * msPerMinute;
    default: return 60 * msPerMinute; // Default to 1 hour
  }
}

import {
  cancelRfqOrder,
  createRfqOrder,
  fetchRfqMakers,
  fetchRfqOrder,
  fetchRfqOrders,
  submitRfqFill,
} from '@/app/lib/rfq-api';
import {
  getMakerTokenAddress,
  getMakerTokenDecimals,
  getMakerTokenAddressFromOrder,
  getMakerTokenDecimalsFromOrder,
  getTakerTokenAddressFromOrder,
  getTakerTokenDecimalsFromOrder,
} from '@/app/lib/token-utils';
import type {
  RFQFillRequestResult,
  RFQMakerMeta,
  RFQOrder,
  RFQOrderBookBuckets,
  RFQQuoteSubmission,
} from '@/app/types/rfq';
import type { OrderSide } from '@/app/types/rfq';
import { useWallet } from '@/app/contexts/WalletContext';
import type { RFQStorageAccountDetails, StorageAccountState } from '@/app/types/rfq-blockchain';

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
  createQuote: (submission: RFQQuoteSubmission, storageAccountAddress?: string) => Promise<RFQOrder>;
  cancelQuote: (orderId: string) => Promise<void>;
  refreshOrders: () => Promise<void>;
  isFilling: boolean;
  lastFillResult?: RFQFillRequestResult;
  escrowState?: StorageAccountState;
  escrowError?: string | null;
  isVerifyingEscrow: boolean;
  refreshEscrowState: () => Promise<void>;
  lastEscrowVerification: number | null;
}

const RFQContext = createContext<RFQContextValue | undefined>(undefined);

export function RFQProvider({ pair, children }: { pair: string; children: ReactNode }): React.JSX.Element {
  const {
    publicKey,
    fillRFQOrder: walletFillRFQOrder,
    cancelRFQOrder: walletCancelRFQOrder,
    verifyStorageAccount: walletVerifyStorageAccount,
  } = useWallet();
  const walletIdentity = publicKey ?? '';
  const [orders, setOrders] = useState<RFQOrder[]>([]);
  const [makers, setMakers] = useState<RFQMakerMeta[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [fillAmount, setFillAmountState] = useState<number | undefined>(undefined);
  const [isFilling, setIsFilling] = useState(false);
  const [lastFillResult, setLastFillResult] = useState<RFQFillRequestResult | undefined>();
  const [escrowState, setEscrowState] = useState<StorageAccountState | undefined>();
  const [escrowError, setEscrowError] = useState<string | null>(null);
  const [isVerifyingEscrow, setIsVerifyingEscrow] = useState(false);
  const [lastEscrowVerification, setLastEscrowVerification] = useState<number | null>(null);

  const refreshOrders = useCallback(async () => {
    try {
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
    } catch (error) {
      console.error('[RFQ] Failed to refresh orders:', error);
      // Keep existing orders/makers on error, but log the issue
      // This prevents the UI from completely breaking when the RFQ service is unavailable
    }
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

  const refreshEscrowState = useCallback(async () => {
    if (!selectedOrder) {
      setEscrowState(undefined);
      setEscrowError(null);
      setLastEscrowVerification(null);
      return;
    }

    const storageAddress = selectedOrder.storageAccount ?? selectedOrder.unsignedBlock;
    if (!storageAddress) {
      setEscrowState(undefined);
      setEscrowError('RFQ order is missing an escrow account reference.');
      setLastEscrowVerification(null);
      return;
    }

    try {
      setIsVerifyingEscrow(true);
      const state = await walletVerifyStorageAccount(storageAddress);
      setEscrowState(state);
      setEscrowError(null);
      setLastEscrowVerification(Date.now());
    } catch (error) {
      setEscrowError(error instanceof Error ? error.message : 'Failed to verify escrow state');
    } finally {
      setIsVerifyingEscrow(false);
    }
  }, [selectedOrder, walletVerifyStorageAccount]);

  useEffect(() => {
    if (!selectedOrder) {
      setEscrowState(undefined);
      setEscrowError(null);
      setLastEscrowVerification(null);
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    void refreshEscrowState();
  }, [refreshEscrowState, selectedOrder]);

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
        const order = orders.find((candidate) => candidate.id === orderId) ?? selectedOrder;
        if (!order) {
          throw new Error('RFQ order not found locally. Refresh and try again.');
        }

        const takerWallet = takerAddress ?? (walletIdentity || undefined);
        await walletFillRFQOrder({ order, fillAmount: amount, takerAddress: takerWallet });

        const result = await submitRfqFill(orderId, {
          taker_amount: amount,
          taker_address: takerWallet,
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
        void refreshEscrowState();
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
    [orders, refreshEscrowState, selectedOrder, walletFillRFQOrder, walletIdentity],
  );

  const createQuote = useCallback(
    async (submission: RFQQuoteSubmission, storageAccountAddress?: string) => {
      console.log('[RFQContext] createQuote called with storageAccountAddress:', storageAccountAddress);
      console.log('[RFQContext] storageAccountAddress type:', typeof storageAccountAddress);
      console.log('[RFQContext] storageAccountAddress starts with keeta_:', storageAccountAddress?.startsWith('keeta_'));
      console.log('[RFQContext] submission:', submission);
      
      if (!walletIdentity) {
        throw new Error('Connect your wallet before publishing RFQ orders.');
      }

      // CRITICAL: Storage account address is required - no fallback allowed
      if (!storageAccountAddress || !storageAccountAddress.startsWith('keeta_')) {
        throw new Error('Storage account address is required and must be a valid Keeta address. The Maker must create a storage account first.');
      }

      const price = Number.parseFloat(submission.price);
      const size = Number.parseFloat(submission.size);
      if (!Number.isFinite(price) || !Number.isFinite(size)) {
        throw new Error('Enter a valid price and size before publishing.');
      }

      const minFillValue = submission.minFill ? Number.parseFloat(submission.minFill) : undefined;
      const expiryIso = new Date(Date.now() + getExpiryMs(submission.expiryPreset)).toISOString();
      const makerTokenAddress = getMakerTokenAddress(submission.pair, submission.side);
      const makerTokenDecimals = getMakerTokenDecimals(submission.pair, submission.side);

      if (!makerTokenAddress) {
        throw new Error('Token mapping missing for selected pair. Configure token addresses in environment variables.');
      }

      const storagePayload: RFQStorageAccountDetails = {
        pair: submission.pair,
        side: submission.side,
        price,
        size,
        minFill: minFillValue,
        expiry: expiryIso,
        tokenAddress: makerTokenAddress,
        tokenDecimals: makerTokenDecimals,
        fieldType: 'decimals', // Default to decimals field type
        makerAddress: walletIdentity,
        allowlistLabel: submission.allowlistLabel,
        metadata: {
          autoSignProfileId: submission.autoSignProfileId ?? null,
        },
      };

      // Create order in backend (blockchain operations handled in RFQMakerPanel)
      const nowIso = new Date().toISOString();
      const orderId = `order-${Date.now()}`;
      const newOrder: RFQOrder = {
        id: orderId,
        pair: submission.pair,
        side: submission.side,
        price,
        size,
        minFill: minFillValue,
        expiry: expiryIso,
        maker: submission.maker,
        unsignedBlock: null,
        makerSignature: null,
        storageAccount: storageAccountAddress,
        allowlisted: !!submission.allowlistLabel,
        status: 'open',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      console.log('[RFQContext] newOrder.storageAccount:', newOrder.storageAccount);

      const createdOrder = await createRfqOrder(newOrder);
      console.log('[RFQContext] createdOrder.storageAccount:', createdOrder.storageAccount);

      setOrders((prev) => [createdOrder, ...prev]);
      setSelectedOrderId(createdOrder.id);
      setFillAmountState(createdOrder.minFill ?? createdOrder.size);
      void refreshEscrowState();
      return createdOrder;
    },
    [refreshEscrowState, walletIdentity],
  );

  const cancelQuote = useCallback(
    async (orderId: string) => {
      const order = orders.find((candidate) => candidate.id === orderId);
      if (!order) {
        throw new Error('RFQ order not found locally. Refresh and try again.');
      }

      const makerTokenAddress = getMakerTokenAddressFromOrder(order);
      const makerTokenDecimals = getMakerTokenDecimalsFromOrder(order);
      const remaining = Math.max(order.size - (order.takerFillAmount ?? 0), 0);

      if (makerTokenAddress) {
        await walletCancelRFQOrder({
          order,
          tokenAddress: makerTokenAddress,
          tokenDecimals: makerTokenDecimals,
          fieldType: 'decimals', // Default to decimals field type
          amount: remaining,
        });
      }

      await cancelRfqOrder(orderId).catch((error) => {
        console.error('[rfq] Failed to cancel quote', error);
        throw error instanceof Error ? error : new Error('Failed to cancel RFQ quote');
      });

      setOrders((previous) => previous.filter((order) => order.id !== orderId));
      if (selectedOrderId === orderId) {
        setSelectedOrderId(null);
        setFillAmountState(undefined);
      }
      void refreshEscrowState();
    },
    [orders, refreshEscrowState, selectedOrderId, walletCancelRFQOrder],
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
      escrowState,
      escrowError,
      isVerifyingEscrow,
      refreshEscrowState,
      lastEscrowVerification,
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
      escrowState,
      escrowError,
      isVerifyingEscrow,
      refreshEscrowState,
      lastEscrowVerification,
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
