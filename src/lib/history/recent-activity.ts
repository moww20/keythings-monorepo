"use client";

import { createTimedCache } from "@/lib/cache/timed-cache";
import { getHistoryForAccount } from "@/lib/explorer/sdk-read-client";
import type { ExplorerOperation } from "@/lib/explorer/client";
import {
  fetchProviderHistory,
  groupOperationsByBlock,
  normalizeHistoryRecords,
  type CachedTokenMeta,
} from "@/lib/history/provider-history";
import type { KeetaProvider } from "@/types/keeta";
import { z } from "zod";

const CACHE_TTL_MS = 15_000;
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 10;
const PROVIDER_DEPTH = 100;
const PROVIDER_MAX_PAGES = 3;
const SDK_DEPTH = 75;

const recentActivityCache = createTimedCache<string, RecentActivityResult>(CACHE_TTL_MS);

export interface RecentActivityItem {
  id: string;
  type: string;
  formattedAmount?: string;
  amount?: string;
  tokenTicker?: string | null;
  timestampMs?: number;
  blockHash?: string | null;
  blockDate?: string | null;
  source: "provider" | "sdk";
}

export interface RecentActivityResult {
  items: RecentActivityItem[];
  source: "provider" | "sdk" | "mixed";
  fetchedAt: number;
}

interface MergeOptions {
  limit: number;
}

type TimestampInput = number | string | Date | null | undefined;

type OperationSource = "provider" | "sdk";

type ProviderRecords = unknown[];

type TokenMetadataMap = Record<string, CachedTokenMeta>;

const FALLBACK_SOURCE: OperationSource = "provider";

function logDebug(message: string, payload?: Record<string, unknown>): void {
  try {

  } catch {}
}

function logInfo(message: string, payload?: Record<string, unknown>): void {
  try {

  } catch {}
}

function logWarn(message: string, payload?: Record<string, unknown>): void {
  try {

  } catch {}
}

// Minimal validation schemas to ensure we only process valid records
const OperationSchema = z.object({
  type: z.string().optional(),
  block: z
    .object({ $hash: z.string().optional(), date: z.any().optional() })
    .optional(),
  amount: z.string().optional(),
  rawAmount: z.string().optional(),
  tokenTicker: z.string().optional(),
  blockTimestamp: z.union([z.string(), z.number(), z.date()]).optional(),
  timestamp: z.union([z.string(), z.number(), z.date()]).optional(),
});

const SdkRecordSchema = z.object({
  id: z.string().optional(),
  block: z.string().optional(),
  timestamp: z.union([z.string(), z.number(), z.date()]).optional(),
  type: z.string().optional(),
  amount: z.string().optional(),
  tokenTicker: z.string().nullable().optional(),
});

function buildCacheKey(account: string, limit: number): string {
  return `${account}::${limit}`;
}

function normalizeTimestamp(input: TimestampInput): number | undefined {
  if (input == null) {
    return undefined;
  }
  if (typeof input === "number") {
    const ms = input < 1_000_000_000_000 ? input * 1000 : input;
    return Number.isFinite(ms) ? ms : undefined;
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      return undefined;
    }
    if (/^-?\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric)) {
        return undefined;
      }
      return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (input instanceof Date) {
    const value = input.getTime();
    return Number.isNaN(value) ? undefined : value;
  }
  return undefined;
}

function toItemId(op: ExplorerOperation, fallbackIndex: number, source: OperationSource): string {
  const rowId = (op as { rowId?: string }).rowId;
  if (typeof rowId === "string" && rowId.length > 0) {
    return rowId;
  }
  const hash = typeof op.block?.$hash === "string" ? op.block.$hash : "unknown";
  const type = typeof op.type === "string" && op.type.length > 0 ? op.type : "TX";
  return `${source}:${hash}:${type}:${fallbackIndex}`;
}

function resolveTokenTicker(op: ExplorerOperation): string | null {
  if (typeof op.tokenTicker === "string" && op.tokenTicker.trim().length > 0) {
    return op.tokenTicker;
  }
  const metadata = op.tokenMetadata as Record<string, unknown> | undefined;
  const ticker = metadata && typeof metadata.ticker === "string" ? metadata.ticker : undefined;
  return ticker ?? null;
}

function resolveFormattedAmount(op: ExplorerOperation): string | undefined {
  if (typeof op.formattedAmount === "string" && op.formattedAmount.trim().length > 0) {
    return op.formattedAmount;
  }
  const amount = (op as { amount?: unknown }).amount;
  if (typeof amount === "string" && amount.trim().length > 0) {
    const ticker = resolveTokenTicker(op);
    return ticker ? `${amount} ${ticker}` : amount;
  }
  const rawAmount = (op as { rawAmount?: unknown }).rawAmount;
  if (typeof rawAmount === "string" && rawAmount.trim().length > 0) {
    const ticker = resolveTokenTicker(op);
    return ticker ? `${rawAmount} ${ticker}` : rawAmount;
  }
  return undefined;
}

function operationToActivityItem(
  op: ExplorerOperation,
  fallbackIndex: number,
  source: OperationSource,
): RecentActivityItem {
  const blockHash = typeof op.block?.$hash === "string" ? op.block.$hash : null;
  const blockDateRaw = op.block?.date ?? (op as { date?: unknown }).date;
  const timestampMs =
    normalizeTimestamp((op as { blockTimestamp?: unknown }).blockTimestamp as TimestampInput) ??
    normalizeTimestamp(blockDateRaw as TimestampInput) ??
    normalizeTimestamp((op as { timestamp?: unknown }).timestamp as TimestampInput);

  const blockDate = (() => {
    if (blockDateRaw instanceof Date) {
      return blockDateRaw.toISOString();
    }
    if (typeof blockDateRaw === "string" && blockDateRaw.trim().length > 0) {
      return blockDateRaw;
    }
    if (typeof timestampMs === "number") {
      return new Date(timestampMs).toISOString();
    }
    return null;
  })();

  return {
    id: toItemId(op, fallbackIndex, source),
    type: typeof op.type === "string" && op.type.length > 0 ? op.type : "TRANSACTION",
    formattedAmount: resolveFormattedAmount(op),
    amount: typeof (op as { amount?: unknown }).amount === "string"
      ? (op as { amount?: string }).amount
      : typeof (op as { rawAmount?: unknown }).rawAmount === "string"
        ? (op as { rawAmount?: string }).rawAmount
        : undefined,
    tokenTicker: resolveTokenTicker(op),
    timestampMs,
    blockHash,
    blockDate,
    source,
  } satisfies RecentActivityItem;
}

function recordToActivityItem(
  record: {
    id: string;
    block?: string;
    timestamp?: number;
    type?: string;
    amount?: string;
    tokenTicker?: string | null;
  },
  index: number,
): RecentActivityItem {
  const timestampMs = normalizeTimestamp(record.timestamp);
  const blockHash = typeof record.block === "string" && record.block.length > 0 ? record.block : null;
  return {
    id: record.id || `sdk:${blockHash ?? "unknown"}:${index}`,
    type: record.type ? record.type.toUpperCase() : "TRANSACTION",
    formattedAmount: record.amount && record.tokenTicker
      ? `${record.amount} ${record.tokenTicker}`
      : record.amount,
    amount: record.amount,
    tokenTicker: record.tokenTicker ?? null,
    timestampMs,
    blockHash,
    blockDate: timestampMs ? new Date(timestampMs).toISOString() : null,
    source: "sdk",
  } satisfies RecentActivityItem;
}

function sortItemsDesc(items: RecentActivityItem[]): RecentActivityItem[] {
  return items.sort((a, b) => {
    const at = typeof a.timestampMs === "number" ? a.timestampMs : 0;
    const bt = typeof b.timestampMs === "number" ? b.timestampMs : 0;
    if (bt !== at) {
      return bt - at;
    }
    return (b.id ?? "").localeCompare(a.id ?? "");
  });
}

function mergeActivities(
  providerItems: RecentActivityItem[],
  sdkItems: RecentActivityItem[],
  options: MergeOptions,
): RecentActivityItem[] {
  logDebug("mergeActivities:start", {
    provider: providerItems.length,
    sdk: sdkItems.length,
    limit: options.limit,
  });
  const deduped: RecentActivityItem[] = [];
  const seen = new Set<string>();

  const push = (item: RecentActivityItem) => {
    const keyParts = [
      item.blockHash ?? "",
      item.type ?? "",
      item.amount ?? "",
      item.tokenTicker ?? "",
      typeof item.timestampMs === "number" ? Math.round(item.timestampMs).toString() : "",
    ];
    const key = keyParts.join("|");
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(item);
  };

  sortItemsDesc(providerItems).forEach(push);
  sortItemsDesc(sdkItems).forEach(push);
  const sorted = sortItemsDesc(deduped);
  const sliced = sorted.slice(0, options.limit);
  logDebug("mergeActivities:result", {
    deduped: deduped.length,
    returned: sliced.length,
    keys: sliced.map((item) => ({ id: item.id, source: item.source, ts: item.timestampMs ?? null })),
  });
  return sliced;
}

async function loadProviderRecords(account: string, limit: number): Promise<RecentActivityItem[]> {
  const provider: KeetaProvider | undefined =
    typeof window !== "undefined" ? ((window as unknown as { keeta?: KeetaProvider }).keeta ?? undefined) : undefined;
  if (!provider) {
    logWarn("loadProviderRecords:no-provider", { account });
    return [];
  }

  const tokenMetadata: TokenMetadataMap = {};
  const aggregated: ExplorerOperation[] = [];
  let cursor: string | null = null;
  let page = 0;

  logInfo("loadProviderRecords:start", { account, limit });

  while (page < PROVIDER_MAX_PAGES && aggregated.length < limit * 4) {
    try {
      const pageResult = await fetchProviderHistory(provider, {
        depth: PROVIDER_DEPTH,
        cursor: cursor ?? undefined,
      });

      const rawRecords = Array.isArray(pageResult.records)
        ? (pageResult.records as ProviderRecords)
        : [];
      logDebug("loadProviderRecords:page", {
        page,
        rawRecords: rawRecords.length,
        hasMore: pageResult.hasMore,
        cursor: pageResult.cursor ?? null,
      });
      if (rawRecords.length === 0) {
        logDebug("loadProviderRecords:break-empty", { page });
        break;
      }

      const normalized = normalizeHistoryRecords(rawRecords as any[], account, tokenMetadata);
      logDebug("loadProviderRecords:normalized", {
        operations: normalized.operations.length,
        tokensToFetch: normalized.tokensToFetch.length,
        blocksToFetch: normalized.blocksToFetch.length,
      });
      if (normalized.operations.length > 0) {
        const grouped = groupOperationsByBlock(normalized.operations);
        logDebug("loadProviderRecords:grouped", { grouped: grouped.length });
        aggregated.push(...grouped);
      }

      if (!pageResult.hasMore || !pageResult.cursor) {
        logDebug("loadProviderRecords:break-end", { page });
        break;
      }

      cursor = pageResult.cursor;
      page += 1;
    } catch (error) {
      logWarn("loadProviderRecords:error", {
        page,
        error: error instanceof Error ? error.message : String(error),
      });
      break;
    }
  }

  const validated = aggregated.filter((operation) => OperationSchema.safeParse(operation).success);
  if (validated.length < aggregated.length) {
    logWarn("loadProviderRecords:filtered-invalid", {
      total: aggregated.length,
      valid: validated.length,
    });
  }
  const mapped = validated.map((operation, index) => operationToActivityItem(operation, index, "provider"));
  logInfo("loadProviderRecords:done", { account, pages: page + 1, aggregated: aggregated.length, returned: mapped.length });
  return mapped;
}

async function loadSdkRecords(account: string, limit: number): Promise<RecentActivityItem[]> {
  try {
    logInfo("loadSdkRecords:start", { account, limit });
    const sdkRecords = await getHistoryForAccount(account, {
      depth: Math.max(limit * 5, SDK_DEPTH),
      includeTokenMetadata: true,
    });
    if (!Array.isArray(sdkRecords) || sdkRecords.length === 0) {
      logDebug("loadSdkRecords:empty", { account });
      return [];
    }
    const validated = sdkRecords.filter((record) => SdkRecordSchema.safeParse(record).success);
    if (validated.length < sdkRecords.length) {
      logWarn("loadSdkRecords:filtered-invalid", {
        total: sdkRecords.length,
        valid: validated.length,
      });
    }
    const mapped = validated.map((record, index) => recordToActivityItem(record as any, index));
    logInfo("loadSdkRecords:done", { account, returned: mapped.length });
    return mapped;
  } catch (error) {
    logWarn("loadSdkRecords:error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function loadRecentActivity(account: string, limit: number): Promise<RecentActivityResult> {
  logInfo("loadRecentActivity:start", { account, limit });

  // Provider-only path (use wallet history like the History page)
  const providerItems = await loadProviderRecords(account, limit);

  const items = sortItemsDesc(providerItems).slice(0, limit);
  const source: RecentActivityResult["source"] = "provider";

  const result = {
    items,
    source,
    fetchedAt: Date.now(),
  } satisfies RecentActivityResult;
  logInfo("loadRecentActivity:done", {
    account,
    limit,
    returned: items.length,
    source,
    providerItems: providerItems.length,
    sdkItems: 0,
  });
  return result;
}

export async function fetchRecentActivityItems(
  account: string,
  options?: { limit?: number; forceRefresh?: boolean },
): Promise<RecentActivityResult> {
  const trimmed = typeof account === "string" ? account.trim() : "";
  if (!trimmed) {
    logWarn("fetchRecentActivityItems:empty-account", { rawAccount: account });
    return { items: [], source: FALLBACK_SOURCE, fetchedAt: Date.now() };
  }

  const limit = Math.max(1, Math.min(options?.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
  const key = buildCacheKey(trimmed, limit);

  logInfo("fetchRecentActivityItems:request", {
    account: trimmed,
    limit,
    forceRefresh: Boolean(options?.forceRefresh),
    cacheKey: key,
  });

  return recentActivityCache.get(
    key,
    async () => {
      logDebug("fetchRecentActivityItems:cache-miss", { account: trimmed, limit });
      const loaded = await loadRecentActivity(trimmed, limit);
      logDebug("fetchRecentActivityItems:cache-store", {
        account: trimmed,
        limit,
        returned: loaded.items.length,
        source: loaded.source,
      });
      return loaded;
    },
    { forceRefresh: options?.forceRefresh },
  );
}

export function peekRecentActivityItems(
  account: string,
  options?: { limit?: number },
): RecentActivityResult | undefined {
  const trimmed = typeof account === "string" ? account.trim() : "";
  if (!trimmed) {
    return undefined;
  }
  const limit = Math.max(1, Math.min(options?.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
  const key = buildCacheKey(trimmed, limit);
  const cached = recentActivityCache.peek(key);
  logDebug("peekRecentActivityItems", {
    account: trimmed,
    limit,
    cacheHit: Boolean(cached),
    returned: cached?.items.length ?? 0,
  });
  return cached;
}

export function invalidateRecentActivityItems(
  account?: string,
  options?: { limit?: number },
): void {
  if (!account) {
    recentActivityCache.clear();
    return;
  }
  const trimmed = account.trim();
  if (!trimmed) {
    return;
  }
  const limit = Math.max(1, Math.min(options?.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
  const key = buildCacheKey(trimmed, limit);
  logInfo("invalidateRecentActivityItems", { account: trimmed, limit });
  recentActivityCache.delete(key);
}
