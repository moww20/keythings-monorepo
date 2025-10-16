import { z } from 'zod';

import type {
  RFQFillRequestResult,
  RFQMakerMeta,
  RFQOrder,
} from '@/app/types/rfq';

const DEFAULT_API_BASE = 'http://localhost:8080';

function getApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_RFQ_API_URL ?? DEFAULT_API_BASE;
  return configured.replace(/\/$/, '');
}

const makerSchema = z
  .object({
    id: z.string(),
    display_name: z.string(),
    verified: z.boolean().optional().default(false),
    reputation_score: z.number().optional().default(0),
    auto_sign_sla_ms: z.number().optional().default(0),
    fills_completed: z.number().optional().default(0),
    failure_rate: z.number().optional().default(0),
    allowlist_label: z.string().nullish(),
  })
  .transform<RFQMakerMeta>((value) => ({
    id: value.id,
    displayName: value.display_name,
    verified: value.verified,
    reputationScore: value.reputation_score,
    autoSignSlaMs: value.auto_sign_sla_ms,
    fillsCompleted: value.fills_completed,
    failureRate: value.failure_rate,
    allowlistLabel: value.allowlist_label ?? undefined,
  }));

const rfqStatusSchema = z
  .enum(['open', 'pending_fill', 'filled', 'expired', 'cancelled', 'failed'])
  .transform<'open' | 'pending_fill' | 'filled' | 'expired'>((status) => {
    switch (status) {
      case 'open':
      case 'pending_fill':
      case 'filled':
      case 'expired':
        return status;
      case 'cancelled':
      case 'failed':
      default:
        return 'expired';
    }
  });

const orderSchema = z
  .object({
    id: z.string(),
    pair: z.string(),
    side: z.union([z.literal('buy'), z.literal('sell')]),
    price: z.union([z.string(), z.number()]),
    size: z.union([z.string(), z.number()]),
    min_fill: z.union([z.string(), z.number(), z.null()]).optional(),
    expiry: z.string(),
    maker: makerSchema,
    unsigned_block: z.string(),
    maker_signature: z.string(),
    storage_account: z.string().optional(),
    allowlisted: z.boolean().optional().default(false),
    status: rfqStatusSchema,
    taker_fill_amount: z.union([z.string(), z.number(), z.null()]).optional(),
    taker_address: z.string().nullish(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .transform<RFQOrder>((value) => ({
    id: value.id,
    pair: value.pair,
    side: value.side,
    price: typeof value.price === 'string' ? Number.parseFloat(value.price) : value.price,
    size: typeof value.size === 'string' ? Number.parseFloat(value.size) : value.size,
    minFill:
      value.min_fill == null
        ? undefined
        : typeof value.min_fill === 'string'
          ? Number.parseFloat(value.min_fill)
          : value.min_fill,
    expiry: value.expiry,
    maker: value.maker,
    unsignedBlock: value.unsigned_block,
    makerSignature: value.maker_signature,
    storageAccount: value.storage_account ?? value.unsigned_block,
    allowlisted: value.allowlisted ?? false,
    status: value.status,
    takerFillAmount:
      value.taker_fill_amount == null
        ? undefined
        : typeof value.taker_fill_amount === 'string'
          ? Number.parseFloat(value.taker_fill_amount)
          : value.taker_fill_amount,
    takerAddress: value.taker_address ?? undefined,
    createdAt: value.created_at ?? new Date().toISOString(),
    updatedAt: value.updated_at ?? new Date().toISOString(),
  }));

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBase = getApiBase();
  
  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `RFQ API request failed with ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  } catch (error) {
    // Provide more helpful error messages based on the error type
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(
        `Unable to connect to RFQ API at ${apiBase}. ` +
        `Please ensure the RFQ backend service is running. ` +
        `For development, you may need to start the external RFQ service or configure a local instance.`
      );
    }
    
    // Re-throw other errors as-is
    throw error;
  }
}

export async function fetchRfqOrders(pair: string): Promise<RFQOrder[]> {
  try {
    const query = new URLSearchParams({ pair });
    const payload = await apiRequest<unknown>(`/api/rfq/orders?${query.toString()}`);
    const listSchema = z.array(orderSchema);
    const result = listSchema.safeParse(payload);
    if (!result.success) {
      console.warn('[rfq-api] Failed to parse RFQ order list', result.error.flatten());
      return [];
    }
    return result.data;
  } catch (error) {
    console.error('[rfq-api] Failed to fetch RFQ orders', error);
    return [];
  }
}

export async function fetchRfqOrder(orderId: string): Promise<RFQOrder | null> {
  try {
    const payload = await apiRequest<unknown>(`/api/rfq/orders/${encodeURIComponent(orderId)}`);
    const parsed = orderSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn('[rfq-api] Failed to parse RFQ order response', parsed.error.flatten());
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.error('[rfq-api] Failed to load RFQ order', error);
    return null;
  }
}

export async function fetchRfqMakers(): Promise<RFQMakerMeta[]> {
  try {
    const payload = await apiRequest<unknown>('/api/rfq/makers');
    const listSchema = z.array(makerSchema);
    const result = listSchema.safeParse(payload);
    if (!result.success) {
      console.warn('[rfq-api] Failed to parse maker profiles', result.error.flatten());
      return [];
    }
    return result.data;
  } catch (error) {
    console.error('[rfq-api] Failed to load maker profiles', error);
    return [];
  }
}

interface SubmitFillPayload {
  taker_address?: string;
  taker_amount: number;
  auto_publish?: boolean;
}

const fillResponseSchema = z
  .object({
    order: orderSchema,
    status: z.enum(['initiated', 'settled', 'rejected']).optional().default('initiated'),
    latency_ms: z.number().optional().default(0),
  })
  .transform<RFQFillRequestResult>((value) => ({
    order: value.order,
    status: value.status,
    latencyMs: value.latency_ms,
  }));

export async function submitRfqFill(
  orderId: string,
  payload: SubmitFillPayload,
): Promise<RFQFillRequestResult> {
  const response = await apiRequest<unknown>(
    `/api/rfq/orders/${encodeURIComponent(orderId)}/fill-request`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

  const parsed = fillResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new Error('Failed to parse RFQ fill response');
  }

  return parsed.data;
}

export async function createRfqOrder(order: RFQOrder): Promise<RFQOrder> {
  // Transform frontend camelCase to backend snake_case
  const backendOrder = {
    id: order.id,
    pair: order.pair,
    side: order.side,
    price: order.price,
    size: order.size,
    min_fill: order.minFill,
    expiry: order.expiry,
    maker: {
      id: order.maker.id,
      display_name: order.maker.displayName,
      verified: order.maker.verified,
      reputation_score: order.maker.reputationScore,
      auto_sign_sla_ms: order.maker.autoSignSlaMs,
      fills_completed: order.maker.fillsCompleted,
      failure_rate: order.maker.failureRate,
      allowlist_label: order.maker.allowlistLabel,
    },
    unsigned_block: order.unsignedBlock,
    maker_signature: order.makerSignature,
    storage_account: order.storageAccount ?? order.unsignedBlock,
    allowlisted: order.allowlisted,
    status: order.status,
    taker_fill_amount: order.takerFillAmount,
    taker_address: order.takerAddress,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  };

  const response = await apiRequest<unknown>('/api/rfq/orders', {
    method: 'POST',
    body: JSON.stringify(backendOrder),
  });

  const parsed = orderSchema.safeParse(response);
  if (!parsed.success) {
    throw new Error('Failed to parse RFQ order creation response');
  }

  return parsed.data;
}

export async function cancelRfqOrder(orderId: string): Promise<void> {
  await apiRequest<void>(`/api/rfq/orders/${encodeURIComponent(orderId)}`, {
    method: 'DELETE',
  });
}
