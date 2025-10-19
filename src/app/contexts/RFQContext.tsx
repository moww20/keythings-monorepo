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
  fetchDeclarations,
  fetchRfqAvailablePairs,
  fetchRfqMakers,
  fetchRfqOrder,
  fetchRfqOrders,
  submitRfqFill,
} from '@/app/lib/rfq-api';
import {
  getMakerTokenAddress,
  getMakerTokenAddressFromOrder,
  getTakerTokenAddressFromOrder,
  toBaseUnits,
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

const TAKER_DECLARATIONS_STORAGE_PREFIX = 'rfq_taker_declarations:';

interface TokenDescriptor {
  symbol: string;
  address?: string;
  decimals?: number;
  isListed?: boolean;
}

interface RFQContextValue {
  tokenA: TokenDescriptor | null;
  tokenB: TokenDescriptor | null;
  pair: string;
  side: OrderSide;
  availablePairs: string[];
  recommendedPair?: string;
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
  takerDeclaredOrderIds: string[];
  registerTakerDeclaration: (orderId: string) => void;
}

const RFQContext = createContext<RFQContextValue | undefined>(undefined);

function normalizeSymbol(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value.trim().toUpperCase();
}

export interface RFQProviderProps {
  tokenA: TokenDescriptor | null;
  tokenB: TokenDescriptor | null;
  children: ReactNode;
}

export function RFQProvider({ tokenA, tokenB, children }: RFQProviderProps): React.JSX.Element {
  const normalizedTokenA = useMemo(() => (tokenA ? { ...tokenA, symbol: normalizeSymbol(tokenA.symbol) } : null), [tokenA]);
  const normalizedTokenB = useMemo(() => (tokenB ? { ...tokenB, symbol: normalizeSymbol(tokenB.symbol) } : null), [tokenB]);
  const derivedPair = normalizedTokenA && normalizedTokenB
    ? `${normalizedTokenA.symbol}/${normalizedTokenB.symbol}`
    : '';
  const derivedSide: OrderSide = 'sell';

  const {
    publicKey,
    getTokenMetadata,
    fillRFQOrder: walletFillRFQOrder,
    cancelRFQOrder: walletCancelRFQOrder,
    verifyStorageAccount: walletVerifyStorageAccount,
    userClient,
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

  const escrowMetadata = escrowState?.metadata;
  const [availablePairs, setAvailablePairs] = useState<string[]>(derivedPair ? [derivedPair] : []);
  const [recommendedPair, setRecommendedPair] = useState<string | undefined>(undefined);
  const [takerDeclaredOrderIds, setTakerDeclaredOrderIds] = useState<string[]>([]);

  const persistTakerDeclaredOrderIds = useCallback(
    (ids: string[]) => {
      if (typeof window === 'undefined' || !walletIdentity) {
        return;
      }
      window.localStorage.setItem(
        `${TAKER_DECLARATIONS_STORAGE_PREFIX}${walletIdentity}`,
        JSON.stringify(ids),
      );
    },
    [walletIdentity],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!walletIdentity) {
      setTakerDeclaredOrderIds([]);
      return;
    }
    const key = `${TAKER_DECLARATIONS_STORAGE_PREFIX}${walletIdentity}`;
    const stored = window.localStorage.getItem(key);
    if (!stored) {
      setTakerDeclaredOrderIds([]);
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setTakerDeclaredOrderIds(parsed.filter((value) => typeof value === 'string'));
      } else {
        setTakerDeclaredOrderIds([]);
      }
    } catch {
      setTakerDeclaredOrderIds([]);
    }
  }, [walletIdentity]);

  useEffect(() => {
    if (!walletIdentity) {
      return;
    }
    const currentOrderIds = new Set(orders.map((order) => order.id));
    const matchingOrderIds = orders
      .filter((order) => order.takerAddress === walletIdentity)
      .map((order) => order.id);
    if (matchingOrderIds.length === 0 && takerDeclaredOrderIds.every((id) => currentOrderIds.has(id))) {
      return;
    }
    setTakerDeclaredOrderIds((previous) => {
      const retained = previous.filter((id) => currentOrderIds.has(id));
      const merged = Array.from(new Set([...retained, ...matchingOrderIds]));
      persistTakerDeclaredOrderIds(merged);
      return merged;
    });
  }, [orders, persistTakerDeclaredOrderIds, takerDeclaredOrderIds, walletIdentity]);

  const registerTakerDeclaration = useCallback(
    (orderId: string) => {
      setTakerDeclaredOrderIds((previous) => {
        if (previous.includes(orderId)) {
          return previous;
        }
        const next = [...previous, orderId];
        persistTakerDeclaredOrderIds(next);
        return next;
      });
    },
    [persistTakerDeclaredOrderIds],
  );

  const refreshOrders = useCallback(async () => {
    if (!derivedPair) {
      setOrders([]);
      setMakers([]);
      setSelectedOrderId(null);
      setFillAmountState(undefined);
      return;
    }

    console.debug('[RFQContext] refreshOrders:start', { pair: derivedPair });
    try {
      const [orderList, makerList] = await Promise.all([fetchRfqOrders(derivedPair), fetchRfqMakers()]);
      console.debug('[RFQContext] refreshOrders:data', {
        pair: derivedPair,
        orderCount: orderList.length,
        makerCount: makerList.length,
        firstOrder: orderList[0],
      });
      setOrders(orderList);
      setMakers(makerList);

      if (orderList.length === 0) {
        console.debug('[RFQContext] refreshOrders:empty', { pair: derivedPair });
        const allOrders = await fetchRfqOrders();
        const pairs = Array.from(new Set(allOrders.map((order) => order.pair))).filter(Boolean);
        setAvailablePairs((prev) => {
          const next = new Set(prev);
          if (derivedPair) {
            next.add(derivedPair);
          }
          pairs.forEach((candidate) => next.add(candidate));
          return Array.from(next);
        });
        const firstDifferentPair = pairs.find((candidate) => candidate !== derivedPair);
        setRecommendedPair(firstDifferentPair);
        setSelectedOrderId(null);
        setFillAmountState(undefined);
        if (walletIdentity) {
          const takerMatches = allOrders
            .filter((order) => order.takerAddress === walletIdentity)
            .map((order) => order.id);
          if (takerMatches.length > 0) {
            setTakerDeclaredOrderIds((previous) => {
              const merged = Array.from(new Set([...previous, ...takerMatches]));
              persistTakerDeclaredOrderIds(merged);
              return merged;
            });
          }
        }
        return;
      }

      const defaultOrder = orderList.find((order) => order.status === 'open') ?? orderList[0];
      console.debug('[RFQContext] refreshOrders:defaultOrder', { pair: derivedPair, defaultOrderId: defaultOrder?.id });
      setAvailablePairs((previous) => {
        const next = new Set(previous);
        if (derivedPair) {
          next.add(derivedPair);
        }
        orderList.forEach((order: RFQOrder) => {
          if (order.pair) {
            next.add(order.pair);
          }
        });
        return Array.from(next);
      });
      setRecommendedPair(undefined);
      setSelectedOrderId(defaultOrder?.id ?? null);
      setFillAmountState(defaultOrder ? defaultOrder.minFill ?? defaultOrder.size : undefined);
      if (walletIdentity) {
        const takerMatches = orderList
          .filter((order) => order.takerAddress === walletIdentity)
          .map((order) => order.id);
        if (takerMatches.length > 0) {
          setTakerDeclaredOrderIds((previous) => {
            const merged = Array.from(new Set([...previous, ...takerMatches]));
            persistTakerDeclaredOrderIds(merged);
            return merged;
          });
        }
      }
    } catch (error) {
      console.error('[RFQ] Failed to refresh orders:', error);
    }
  }, [derivedPair, walletIdentity, persistTakerDeclaredOrderIds]);

  useEffect(() => {
    console.debug('[RFQContext] useEffect(refreshOrders) invoked', { pair: derivedPair });
    void refreshOrders();
  }, [refreshOrders, derivedPair]);

  useEffect(() => {
    let cancelled = false;
    const loadPairs = async () => {
      const pairs = await fetchRfqAvailablePairs();
      if (!cancelled && pairs.length > 0) {
        setAvailablePairs((prev) => Array.from(new Set([...prev, ...pairs])));
      }
    };
    void loadPairs();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId),
    [orders, selectedOrderId],
  );

  useEffect(() => {
    console.debug('[RFQContext] selectedOrder updated', {
      selectedOrderId,
      selectedOrder,
    });
    if (selectedOrder) {
      setFillAmountState(selectedOrder.minFill ?? selectedOrder.size);
    } else {
      setFillAmountState(undefined);
    }
  }, [selectedOrder, selectedOrderId]);

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
      console.debug('[RFQContext] refreshEscrowState:resolved', {
        storageAddress,
        balancesCount: state?.balances?.length,
      });
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
    console.debug('[RFQContext] setFillAmount invoked', { value });
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

      if (!derivedPair) {
        throw new Error('Select Token A and Token B before creating RFQ quotes.');
      }

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
      const makerTokenAddress = getMakerTokenAddress(derivedPair, derivedSide);
      
      // Get token metadata from wallet context instead of deprecated function
      let makerTokenDecimals = 9; // Default fallback
      if (makerTokenAddress) {
        const tokenMetadata = await getTokenMetadata(makerTokenAddress);
        if (tokenMetadata) {
          makerTokenDecimals = tokenMetadata.decimals;
        }
      }

      if (!makerTokenAddress) {
        throw new Error('Token mapping missing for selected pair. Configure token addresses in environment variables.');
      }

      const storagePayload: RFQStorageAccountDetails = {
        pair: derivedPair,
        side: derivedSide,
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
        pair: derivedPair,
        side: derivedSide,
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

      console.debug('[RFQContext] createQuote:payload', {
        orderId,
        storageAccount: newOrder.storageAccount,
        pair: newOrder.pair,
        side: newOrder.side,
        price,
        size,
        minFillValue,
        expiryIso,
      });

      const createdOrder = await createRfqOrder(newOrder);
      console.debug('[RFQContext] createQuote:response', {
        createdOrderId: createdOrder.id,
        storageAccount: createdOrder.storageAccount,
        status: createdOrder.status,
      });

      setOrders((prev) => [createdOrder, ...prev]);
      setSelectedOrderId(createdOrder.id);
      setFillAmountState(createdOrder.minFill ?? createdOrder.size);
      void refreshEscrowState();
      return createdOrder;
    },
    [derivedPair, walletIdentity, getTokenMetadata, refreshEscrowState],
  );

  const cancelQuote = useCallback(
    async (orderId: string) => {
      const order = orders.find((candidate) => candidate.id === orderId);
      if (!order) {
        throw new Error('RFQ order not found locally. Refresh and try again.');
      }

      const declarations = await fetchDeclarations(orderId);
      const hasPendingDeclaration = declarations.some((declaration) => declaration.status === 'pending');
      if (hasPendingDeclaration) {
        throw new Error('Cannot cancel quote while a taker declaration is pending. Please resolve declarations first.');
      }

      const remaining = Math.max(order.size - (order.takerFillAmount ?? 0), 0);

      if (remaining > 0) {
        const makerTokenAddress = getMakerTokenAddressFromOrder(order);
        const normalizedTokenAddress = typeof makerTokenAddress === 'string' ? makerTokenAddress.trim() : '';
        const isPlaceholderToken =
          normalizedTokenAddress.length === 0 || normalizedTokenAddress.startsWith('PLACEHOLDER_');
        const sanitizedTokenAddress = !isPlaceholderToken
          ? normalizedTokenAddress
          : (() => {
              const storedMetadata = escrowMetadata;
              const derivedFromEscrow = order.storageAccount && storedMetadata && typeof storedMetadata === 'object'
                ? (storedMetadata as Record<string, unknown>)?.atomicSwap &&
                  typeof (storedMetadata as Record<string, unknown>).atomicSwap === 'object'
                  ? ((storedMetadata as { atomicSwap?: { makerToken?: unknown } }).atomicSwap?.makerToken as string | undefined)
                  : undefined
                : null;
              if (derivedFromEscrow && typeof derivedFromEscrow === 'string') {
                const trimmed = derivedFromEscrow.trim();
                if (trimmed.length > 0 && !trimmed.startsWith('PLACEHOLDER_')) {
                  console.debug('[rfq] Using storage metadata token reference for cancellation', {
                    orderId,
                    derivedFromEscrow: trimmed,
                  });
                  return trimmed;
                }
              }
              return '';
            })();

        let makerTokenDecimals = 9;
        if (!isPlaceholderToken && sanitizedTokenAddress) {
          const tokenMetadata = await getTokenMetadata(sanitizedTokenAddress);
          if (tokenMetadata) {
            makerTokenDecimals = tokenMetadata.decimals;
          } else if (order.storageAccount) {
            try {
              const state = await walletVerifyStorageAccount(order.storageAccount);
              const balanceEntry = state.balances?.find((entry) => entry.token === sanitizedTokenAddress);
              if (balanceEntry && typeof balanceEntry.decimals === 'number') {
                makerTokenDecimals = balanceEntry.decimals;
              }
            } catch (error) {
              console.warn('[rfq] Failed to fetch storage balance metadata during cancellation', error);
            }
          }
        }

        try {
          const storageAddress = order.storageAccount ?? order.unsignedBlock;
          if (!storageAddress) {
            throw new Error('Storage account reference missing during cancellation.');
          }

          const makerAccount = order.maker.id;
          const normalizedMakerAccount = typeof makerAccount === 'string' ? makerAccount.trim() : '';
          if (!normalizedMakerAccount) {
            throw new Error('Maker account missing during cancellation.');
          }

          if (!userClient) {
            throw new Error('Wallet client unavailable for cancellation. Connect your wallet again.');
          }

          const builder = userClient.initBuilder?.();
          if (!builder) {
            throw new Error('Wallet client did not provide a builder for cancellation.');
          }

          const sendFn = (builder as { send?: (...args: unknown[]) => unknown }).send;
          if (typeof sendFn !== 'function') {
            throw new Error('Wallet builder does not expose a send method for cancellation.');
          }

          let makerAmount = toBaseUnits(remaining, makerTokenDecimals);

          if (makerAmount <= BigInt(0)) {
            console.info('[rfq] Cancellation skipped transfer because remaining amount is non-positive', {
              orderId,
              remaining,
            });
            makerAmount = BigInt(0);
          }

          let availableFromStorage: bigint | null = null;
          let balanceInfoDiscovered = false;

          if (makerAmount > BigInt(0)) {
            if (typeof order.storageAccount === 'string') {
              try {
                const storageSnapshot = await walletVerifyStorageAccount(order.storageAccount);
                const tokenEntry = storageSnapshot.balances?.find((entry) => entry.token === sanitizedTokenAddress);
                if (tokenEntry) {
                  availableFromStorage = BigInt(tokenEntry.amount ?? 0);
                  balanceInfoDiscovered = true;
                  if (availableFromStorage < makerAmount) {
                    console.warn('[rfq] Storage balance lower than expected during cancellation; clamping transfer', {
                      orderId,
                      requested: makerAmount.toString(),
                      available: availableFromStorage.toString(),
                    });
                    makerAmount = availableFromStorage;
                  }
                }
              } catch (error) {
                console.warn('[rfq] Unable to verify storage balance during cancellation', error);
              }
            }

            if (!balanceInfoDiscovered && makerAmount > BigInt(0)) {
              console.warn('[rfq] No storage balance entry found for maker token during cancellation; skipping token transfer', {
                orderId,
                sanitizedTokenAddress,
              });
              makerAmount = BigInt(0);
            }
          }

          const storageAccountRef = { publicKeyString: storageAddress };
          const makerAccountRef = { publicKeyString: normalizedMakerAccount };

          const pendingOperations: Array<Promise<unknown>> = [];

          const payFeeFn = (builder as { payPlatformFee?: (account: { publicKeyString: string } | string, amount?: bigint | number) => unknown }).payPlatformFee;
          if (typeof payFeeFn === 'function') {
            try {
              pendingOperations.push(
                Promise.resolve(
                  payFeeFn.call(
                    builder,
                    makerAccountRef,
                  ),
                ),
              );
            } catch (error) {
              console.warn('[rfq] Failed to enqueue platform fee payment during cancellation', error);
            }
          }

          if (makerAmount > BigInt(0)) {
            pendingOperations.push(
              Promise.resolve(
                sendFn.call(
                  builder,
                  makerAccountRef,
                  makerAmount,
                  sanitizedTokenAddress || undefined,
                  undefined,
                  { account: storageAccountRef },
                ),
              ),
            );
          } else {
            console.info('[rfq] No tokens to return during cancellation; skipping send operation', {
              orderId,
              availableFromStorage: availableFromStorage?.toString() ?? null,
              remaining,
              sanitizedTokenAddress,
            });
            console.info('[rfq] No tokens to return during cancellation; skipping send operation', { orderId });
          }

          await Promise.all(pendingOperations);

          if (pendingOperations.length === 0 || makerAmount === BigInt(0)) {
            console.info('[rfq] Cancellation completed without submitting a builder (no token movements required)', {
              orderId,
            });
          } else {
            const receipt = await userClient.publishBuilder?.(builder);
            if (!receipt) {
              throw new Error('Wallet failed to publish cancellation transaction.');
            }
            console.debug('[rfq] Cancellation builder published', { orderId, receipt });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes('Resulting balance becomes negative')) {
            console.warn('[rfq] Wallet reported empty escrow during cancellation', {
              orderId,
              message,
            });
          } else {
            throw error instanceof Error ? error : new Error(message);
          }
        }
      }

      await cancelRfqOrder(orderId).catch((error) => {
        console.error('[rfq] Failed to cancel quote', error);
        throw error instanceof Error ? error : new Error('Failed to cancel RFQ quote');
      });

      setOrders((previous) => previous.filter((candidate) => candidate.id !== orderId));
      if (selectedOrderId === orderId) {
        setSelectedOrderId(null);
        setFillAmountState(undefined);
      }
      void refreshEscrowState();
    },
    [escrowMetadata, getTokenMetadata, refreshEscrowState, selectedOrderId, userClient, walletVerifyStorageAccount, orders],
  );

  const value = useMemo<RFQContextValue>(
    () => ({
      tokenA: normalizedTokenA,
      tokenB: normalizedTokenB,
      pair: derivedPair,
      side: derivedSide,
      availablePairs,
      recommendedPair,
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
      takerDeclaredOrderIds,
      registerTakerDeclaration,
    }),
    [
      normalizedTokenA,
      normalizedTokenB,
      derivedPair,
      derivedSide,
      availablePairs,
      recommendedPair,
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
      takerDeclaredOrderIds,
      registerTakerDeclaration,
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
