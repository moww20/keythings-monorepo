"use client";

import { createTimedCache } from "@/lib/cache/timed-cache";
import { getHistory as sdkGetHistory } from "@/lib/explorer/sdk-read-client";

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
  const depth = options.depth ?? undefined;
  const cursor = options.cursor ?? undefined;
  const staples = (await sdkGetHistory({ depth, cursor })) as unknown[];
  // SDK returns an array of history entries (vote staples + effects). We surface them as records.
  const records = Array.isArray(staples) ? (staples as WalletHistoryRecord[] as any) : [];
  // SDK path currently does not provide pagination cursor; expose null for now.
  return { records, nextCursor: null };
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
