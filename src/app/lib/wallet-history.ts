"use client";

import { createTimedCache } from "@/lib/cache/timed-cache";

export interface WalletHistoryOptions {
  depth?: number;
  cursor?: string | null;
  includeOperations?: boolean;
  includeTokenMetadata?: boolean;
}

export interface WalletHistoryRecord {
  id?: string;
  hash?: string;
  block?: string;
  createdAt?: string;
  date?: string | number | Date;
  timestamp?: number | string | Date;
  account?: string;
  amount?: string | number | bigint;
  rawAmount?: string | number | bigint;
  formattedAmount?: string;
  token?: string;
  tokenAddress?: string;
  tokenTicker?: string;
  tokenDecimals?: number;
  tokenMetadata?: unknown;
  metadata?: unknown;
  from?: string;
  to?: string;
  operationType?: string | number;
  voteStaple?: unknown;
  operations?: unknown;
}

export interface WalletHistoryResponse {
  records: WalletHistoryRecord[];
  nextCursor: string | null;
}

const historyCache = createTimedCache<string, WalletHistoryResponse>(30_000);

function buildKey(options: WalletHistoryOptions): string {
  return JSON.stringify({
    depth: options.depth ?? null,
    cursor: options.cursor ?? null,
    includeOperations: options.includeOperations ?? false,
    includeTokenMetadata: options.includeTokenMetadata ?? false,
  });
}

async function requestHistory(options: WalletHistoryOptions): Promise<WalletHistoryResponse> {
  if (typeof window === "undefined" || !window.keeta?.history) {
    return { records: [], nextCursor: null };
  }

  const response = await window.keeta.history({
    depth: options.depth,
    cursor: options.cursor ?? null,
    includeOperations: options.includeOperations ?? false,
    includeTokenMetadata: options.includeTokenMetadata ?? false,
  } as any);

  if (!response || typeof response !== "object") {
    return { records: [], nextCursor: null };
  }

  const records = Array.isArray((response as any).records)
    ? ((response as any).records as WalletHistoryRecord[])
    : [];
  const nextCursor = typeof (response as any).nextCursor === "string" ? (response as any).nextCursor : null;

  return { records, nextCursor };
}

export async function fetchWalletHistory(
  options: WalletHistoryOptions,
  opts: { forceRefresh?: boolean } = {},
): Promise<WalletHistoryResponse> {
  const key = buildKey(options);
  return historyCache.get(key, () => requestHistory(options), { forceRefresh: opts.forceRefresh });
}

export function peekWalletHistory(options: WalletHistoryOptions): WalletHistoryResponse | undefined {
  return historyCache.peek(buildKey(options));
}

export function invalidateWalletHistory(options?: WalletHistoryOptions) {
  if (!options) {
    historyCache.clear();
    return;
  }
  historyCache.delete(buildKey(options));
}
