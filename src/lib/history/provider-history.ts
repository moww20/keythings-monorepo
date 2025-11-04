import { z } from "zod";

import { coerceString as sx, resolveDate, resolveTimestampMs } from "@/lib/explorer/mappers";
import { parseExplorerOperation } from "@/lib/explorer/client";
import { parseTokenMetadata, formatTokenAmount } from "@/app/explorer/utils/token-metadata";
import { getCachedTokenMetadata as getGlobalCachedTokenMetadata } from "@/lib/tokens/metadata-service";
import type { ExplorerOperation } from "@/lib/explorer/client";
import type { WalletHistoryRecord } from "@/app/lib/wallet-history";
import type { KeetaProvider } from "@/types/keeta";

export const BASE_TOKEN_TICKER = "KTA";
const BASE_TOKEN_DECIMALS = 9;
const BASE_TOKEN_FIELD_TYPE = "decimalPlaces";

// Development logging flag
const __DEV__ = typeof process !== "undefined" && !!(process as any).env && (process as any).env.NODE_ENV !== "production";

export type CachedTokenMeta = {
  name?: string | null;
  ticker?: string | null;
  decimals?: number | null;
  fieldType?: "decimalPlaces" | "decimals";
  metadataBase64?: string | null;
};

export interface NormalizedHistoryResult {
  operations: ExplorerOperation[];
  tokensToFetch: string[];
  blocksToFetch: string[];
}

const ProviderHistoryResponseSchema = z
  .object({
    records: z.array(z.unknown()).default([]),
    cursor: z.string().nullable().optional(),
    hasMore: z.boolean().optional(),
  })
  .passthrough();

export interface ProviderHistoryRequestOptions {
  depth: number;
  cursor?: string | null;
}

export interface ProviderHistoryPage {
  records: unknown[];
  cursor: string | null;
  hasMore: boolean;
}

export async function fetchProviderHistory(
  provider: Pick<KeetaProvider, "history"> | undefined,
  options: ProviderHistoryRequestOptions,
): Promise<ProviderHistoryPage> {
  if (!provider || typeof provider.history !== "function") {
    return { records: [], cursor: null, hasMore: false };
  }

  const requestPayload: { depth: number; cursor?: string; includeOperations?: boolean; includeTokenMetadata?: boolean } = {
    depth: Math.max(1, options.depth),
    includeOperations: true,
    includeTokenMetadata: true,
  };
  if (options.cursor) {
    requestPayload.cursor = options.cursor;
  }

  if (__DEV__) { try { console.debug("[provider-history] request", requestPayload); } catch {} }
  const response = await provider.history(requestPayload);
  const parsed = ProviderHistoryResponseSchema.safeParse(response);
  if (!parsed.success) {
    // Fallback: some providers may return a raw array of records or nest under common keys
    try {
      if (Array.isArray(response)) {
        return { records: response, cursor: null, hasMore: false };
      }
      if (response && typeof response === 'object') {
        const containerKeys = ['records', 'history', 'voteStaples', 'items', 'data'];
        for (const key of containerKeys) {
          const candidate = (response as Record<string, unknown>)[key];
          if (Array.isArray(candidate)) {
            return { records: candidate, cursor: null, hasMore: false };
          }
        }
      }
    } catch {}
    return { records: [], cursor: null, hasMore: false };
  }

  const { records, cursor, hasMore } = parsed.data;
  if (__DEV__) { try { console.debug("[provider-history] response", { records: Array.isArray(records) ? records.length : 0, hasMore: Boolean(hasMore), cursor: cursor ?? null }); } catch {} }
  return {
    records,
    cursor: cursor ?? null,
    hasMore: Boolean(hasMore) && typeof cursor === "string" && cursor.length > 0,
  };
}

function shouldSkipTokenLookup(tokenId?: string | null, ticker?: string | null): boolean {
  if (!tokenId) return true;
  if (tokenId.startsWith("PLACEHOLDER_")) return true;
  if (tokenId === "base") return true;
  if (ticker && ticker.toUpperCase() === BASE_TOKEN_TICKER) return true;
  return false;
}

function coerceAmountString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return undefined;
}

function decimalToBaseUnits(value: string, decimals: number): string | undefined {
  if (!Number.isFinite(decimals) || decimals < 0) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(trimmed)) {
    return undefined;
  }

  const negative = trimmed.startsWith("-");
  const unsigned = negative || trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;
  const [wholePartRaw, fractionRaw = ""] = unsigned.split(".");
  const wholePart = wholePartRaw.replace(/^0+(?=\d)/, "") || "0";
  const fractionDigits = fractionRaw.replace(/[^0-9]/g, "");
  const paddedFraction = (fractionDigits + "0".repeat(decimals)).slice(0, decimals);
  const combined = `${wholePart}${paddedFraction}`.replace(/^0+(?=\d)/, "") || "0";
  if (combined === "0") {
    return "0";
  }
  return negative ? `-${combined}` : combined;
}

function normalizeMetadataCandidate(value: unknown): CachedTokenMeta | undefined {
  if (!value) return undefined;

  if (typeof value === "string") {
    const parsed = parseTokenMetadata(value);
    if (parsed) {
      return {
        name: typeof parsed.name === "string" ? parsed.name : undefined,
        ticker: typeof parsed.ticker === "string" ? parsed.ticker : undefined,
        decimals: typeof parsed.decimals === "number" ? parsed.decimals : undefined,
        fieldType: parsed.fieldType === "decimalPlaces" ? "decimalPlaces" : "decimals",
        metadataBase64: value,
      };
    }
    return { metadataBase64: value };
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const decimals =
      typeof record.decimals === "number"
        ? record.decimals
        : typeof record.decimalPlaces === "number"
          ? record.decimalPlaces
          : undefined;
    const fieldType =
      record.fieldType === "decimalPlaces" || record.fieldType === "decimals"
        ? (record.fieldType as "decimalPlaces" | "decimals")
        : typeof record.decimalPlaces === "number"
          ? "decimalPlaces"
          : undefined;
    const ticker =
      typeof record.ticker === "string"
        ? record.ticker
        : typeof record.symbol === "string"
          ? record.symbol
          : undefined;
    return {
      name: typeof record.name === "string" ? record.name : undefined,
      ticker,
      decimals: typeof decimals === "number" && Number.isFinite(decimals) ? decimals : undefined,
      fieldType,
      metadataBase64:
        typeof record.metadataBase64 === "string"
          ? record.metadataBase64
          : typeof record.metadata === "string"
            ? record.metadata
            : undefined,
    };
  }

  return undefined;
}

function mergeTokenMetadata(
  existing: unknown,
  extras: Array<CachedTokenMeta | undefined>,
): CachedTokenMeta | undefined {
  const result: CachedTokenMeta = {};
  let hasData = false;

  const sources: CachedTokenMeta[] = [];
  if (existing && typeof existing === "object") {
    const record = existing as Record<string, unknown>;
    sources.push({
      name: typeof record.name === "string" ? record.name : undefined,
      ticker:
        typeof record.ticker === "string"
          ? record.ticker
          : typeof record.symbol === "string"
            ? record.symbol
            : undefined,
      decimals: typeof record.decimals === "number" ? record.decimals : undefined,
      fieldType:
        record.fieldType === "decimalPlaces" || record.fieldType === "decimals"
          ? (record.fieldType as "decimalPlaces" | "decimals")
          : undefined,
      metadataBase64:
        typeof record.metadataBase64 === "string"
          ? record.metadataBase64
          : typeof record.metadata === "string"
            ? record.metadata
            : undefined,
    });
  }

  for (const extra of extras) {
    if (extra) {
      sources.push(extra);
    }
  }

  for (const source of sources) {
    if (!source) continue;
    if (source.name && !result.name) {
      result.name = source.name;
      hasData = true;
    }
    if (source.ticker && !result.ticker) {
      result.ticker = source.ticker;
      hasData = true;
    }
    if (
      typeof source.decimals === "number" &&
      Number.isFinite(source.decimals) &&
      result.decimals === undefined
    ) {
      result.decimals = source.decimals;
      hasData = true;
    }
    if (source.fieldType && !result.fieldType) {
      result.fieldType = source.fieldType;
      hasData = true;
    }
    if (source.metadataBase64 && !result.metadataBase64) {
      result.metadataBase64 = source.metadataBase64;
      hasData = true;
    }
  }

  return hasData ? result : undefined;
}

function gatherRecordOperations(record: any): unknown[] {
  const inline = Array.isArray(record?.operations) ? record.operations : [];
  const voteStapleOps = Array.isArray(record?.voteStaple?.operations)
    ? record.voteStaple.operations
    : [];
  const blockOps = Array.isArray(record?.voteStaple?.blocks)
    ? record.voteStaple.blocks.flatMap((block: any) =>
        Array.isArray(block?.operations) ? block.operations : [],
      )
    : [];

  return [...inline, ...voteStapleOps, ...blockOps];
}

export function normalizeHistoryRecords(
  records: any[],
  account: string,
  tokenMetadata: Record<string, CachedTokenMeta>,
): NormalizedHistoryResult {
  if (!records.length) {
    return { operations: [], tokensToFetch: [], blocksToFetch: [] };
  }

  const operations: ExplorerOperation[] = [];
  const tokensToFetch = new Set<string>();
  const blocksToFetch = new Set<string>();
  const seenKeys = new Set<string>();
  const accountKey = typeof account === "string" ? account : "";
  const blockCounters = new Map<string, number>();

  const isFeeLike = (op: any): boolean => {
    const t1 = typeof op?.operationType === "string" ? op.operationType.toUpperCase() : "";
    const t2 = typeof op?.type === "string" ? op.type.toUpperCase() : "";
    const t3 = typeof op?.operation?.type === "string" ? op.operation.type.toUpperCase() : "";
    return t1.includes("FEE") || t2.includes("FEE") || t3.includes("FEE");
  };

  const processCandidate = (candidate: unknown, record: any) => {
    if (!candidate || typeof candidate !== "object") {
      return;
    }

    const op = candidate as Record<string, any>;
    const blockHashCandidate =
      sx(record?.block) ??
      sx(record?.hash) ??
      sx(record?.id) ??
      sx(op.block);
    const blockHash = typeof blockHashCandidate === "string" && blockHashCandidate.length > 0
      ? blockHashCandidate
      : null;
    if (!blockHash) {
      return;
    }

    const normalizedType = typeof op.type === "string" ? op.type.toUpperCase() : "UNKNOWN";

    const rawAmountCandidate =
      coerceAmountString(op.rawAmount ?? record.rawAmount) ??
      coerceAmountString((op as any)?.operation?.rawAmount) ??
      coerceAmountString((record as any)?.operation?.rawAmount);
    const amountCandidate =
      coerceAmountString(op.amount ?? record.amount) ??
      coerceAmountString((op as any)?.operation?.amount) ??
      coerceAmountString((record as any)?.operation?.amount);
    const fallbackToken = sx(op.token ?? op.tokenAddress) ?? sx(record.token ?? record.tokenAddress);
    const fallbackFrom = sx(op.from) ?? sx(op.account) ?? sx(record.from ?? record.account);
    const fallbackTo = sx(op.to ?? op.toAccount) ?? sx(record.to);
    const fallbackFormatted = sx(op.formattedAmount) ?? sx(record.formattedAmount);
    const fallbackTicker = sx(op.tokenTicker) ?? sx(record.tokenTicker);
    const fallbackDecimals = typeof (op.tokenDecimals ?? record.tokenDecimals) === "number"
      ? Number(op.tokenDecimals ?? record.tokenDecimals)
      : undefined;
    const fallbackMetadata = op.tokenMetadata ?? record.tokenMetadata ?? record.metadata;

    const fallbackFieldType =
      (typeof (op.tokenMetadata as CachedTokenMeta | undefined)?.fieldType === "string"
        ? (op.tokenMetadata as CachedTokenMeta | undefined)?.fieldType
        : undefined) ??
      (typeof (record.tokenMetadata as CachedTokenMeta | undefined)?.fieldType === "string"
        ? (record.tokenMetadata as CachedTokenMeta | undefined)?.fieldType
        : undefined);

    let normalizedRawAmount = rawAmountCandidate;
    if (!normalizedRawAmount && amountCandidate && amountCandidate.includes(".")) {
      const decimalsForConversion = fallbackDecimals;
      if (typeof decimalsForConversion === "number") {
        const converted = decimalToBaseUnits(amountCandidate, decimalsForConversion);
        if (converted !== undefined) {
          normalizedRawAmount = converted;
        }
      }
    }

    if (!normalizedRawAmount) {
      normalizedRawAmount = rawAmountCandidate ?? amountCandidate;
    }

    const blockAccountValue =
      sx(op.account) ?? sx(record?.account) ?? sx(record?.from) ?? accountKey;
    const resolvedBlockDate = resolveDate(
      op.date,
      op.block?.date,
      (op.block as any)?.createdAt,
      record?.date,
      record?.createdAt,
      record?.timestamp,
      (record?.block as any)?.date,
      (record?.block as any)?.createdAt,
    );

    const normalizedBlockDate =
      typeof resolvedBlockDate === "string" && resolvedBlockDate.trim().length > 0
        ? resolvedBlockDate
        : undefined;

    const isPlaceholderDate = normalizedBlockDate === undefined;
    const fallbackDate = normalizedBlockDate ?? null;

    const blockTimestampMs = resolveTimestampMs(
      op.date,
      op.block?.date,
      (op.block as any)?.createdAt,
      record?.timestamp,
      record?.date,
      record?.createdAt,
      (record?.block as any)?.date,
      (record?.block as any)?.createdAt,
    );

    const block = {
      $hash: blockHash,
      date: fallbackDate,
      account: blockAccountValue,
      placeholderDate: isPlaceholderDate,
    };

    if (isPlaceholderDate) {
      blocksToFetch.add(blockHash);
    }

    const decimalFormattedCandidate = Boolean(amountCandidate && amountCandidate.includes("."));
    const operationPayload: Record<string, any> = {
      type: normalizedType,
      voteStapleHash: sx(record?.voteStaple?.hash) ?? blockHash,
      block,
      blockTimestamp: typeof blockTimestampMs === "number" ? blockTimestampMs : undefined,
      operation: { ...op },
      amount: amountCandidate ?? coerceAmountString(op.amount),
      rawAmount: normalizedRawAmount,
      formattedAmount: fallbackFormatted ?? sx(op.formattedAmount) ?? (decimalFormattedCandidate ? amountCandidate : undefined),
      token: fallbackToken ?? sx(op.token),
      tokenAddress: fallbackToken ?? sx(op.tokenAddress),
      tokenTicker: fallbackTicker ?? sx(op.tokenTicker),
      tokenDecimals: fallbackDecimals,
      tokenMetadata: fallbackMetadata,
      from: fallbackFrom ?? sx(op.from),
      to: fallbackTo ?? sx(op.to),
      operationType:
        (typeof op.operationType === "string"
          ? op.operationType
          : typeof op.operationType === "number"
            ? String(op.operationType)
            : undefined) ?? record.operationType ?? op.type,
    };

    if (!operationPayload.token && !operationPayload.tokenAddress && !operationPayload.tokenTicker) {
      operationPayload.tokenTicker = BASE_TOKEN_TICKER;
    }

    let metadataFromRecord = normalizeMetadataCandidate(fallbackMetadata);

    const normalizedTickerCandidate = (operationPayload.tokenTicker ?? fallbackTicker ?? "").toUpperCase();
    if (normalizedTickerCandidate === BASE_TOKEN_TICKER) {
      if (!metadataFromRecord) {
        metadataFromRecord = {
          ticker: BASE_TOKEN_TICKER,
          decimals: BASE_TOKEN_DECIMALS,
          fieldType: BASE_TOKEN_FIELD_TYPE,
        } satisfies CachedTokenMeta;
      } else {
        if (!metadataFromRecord.ticker) {
          metadataFromRecord.ticker = BASE_TOKEN_TICKER;
        }
        if (typeof metadataFromRecord.decimals !== "number" || !Number.isFinite(metadataFromRecord.decimals)) {
          metadataFromRecord.decimals = BASE_TOKEN_DECIMALS;
        }
        if (!metadataFromRecord.fieldType) {
          metadataFromRecord.fieldType = BASE_TOKEN_FIELD_TYPE;
        }
      }

      if (typeof operationPayload.tokenDecimals !== "number" || !Number.isFinite(operationPayload.tokenDecimals)) {
        operationPayload.tokenDecimals = BASE_TOKEN_DECIMALS;
      }
      if (!operationPayload.tokenTicker) {
        operationPayload.tokenTicker = BASE_TOKEN_TICKER;
      }
    }

    if (metadataFromRecord) {
      const mergedMeta = mergeTokenMetadata(operationPayload.tokenMetadata, [metadataFromRecord]);
      if (mergedMeta) {
        operationPayload.tokenMetadata = mergedMeta;
        if (!operationPayload.tokenTicker && mergedMeta.ticker) {
          operationPayload.tokenTicker = mergedMeta.ticker;
        }
        if (
          operationPayload.tokenDecimals === undefined &&
          typeof mergedMeta.decimals === "number"
        ) {
          operationPayload.tokenDecimals = mergedMeta.decimals;
        }
      }
    }

    const shouldReformat = (
      (!operationPayload.formattedAmount || decimalFormattedCandidate) &&
      operationPayload.rawAmount &&
      operationPayload.tokenDecimals !== undefined
    );
    if (shouldReformat) {
      try {
        const amt = BigInt(operationPayload.rawAmount as string);
        const ticker = operationPayload.tokenTicker || metadataFromRecord?.ticker || "UNKNOWN";
        const resolvedFieldTypeInner = (operationPayload.tokenMetadata as CachedTokenMeta | undefined)?.fieldType ??
          metadataFromRecord?.fieldType ??
          fallbackFieldType ??
          "decimals";
        const fieldType = resolvedFieldTypeInner === "decimalPlaces" ? "decimalPlaces" : "decimals";

        try {
          if (__DEV__) console.debug("[history] format amount", {
            where: "pre-parseExplorerOperation",
            voteStapleHash: sx(record?.voteStaple?.hash) ?? blockHash,
            blockHash,
            rawAmount: String(operationPayload.rawAmount),
            tokenDecimals: operationPayload.tokenDecimals,
            fieldType,
            ticker,
            hasMeta: Boolean(operationPayload.tokenMetadata),
            metaDecimals: (operationPayload.tokenMetadata as any)?.decimals,
            metaFieldType: (operationPayload.tokenMetadata as any)?.fieldType,
            fallbackDecimals,
            fallbackFieldType,
            decimalFormattedCandidate,
          });
        } catch {}

        operationPayload.formattedAmount = formatTokenAmount(
          amt,
          operationPayload.tokenDecimals,
          fieldType,
          ticker,
        );
      } catch (e) {
        try { console.warn("[history] format amount failed", { error: (e as Error)?.message }); } catch {}
        // ignore formatting errors
      }
    }

    const parsed = parseExplorerOperation(operationPayload);
    if (!parsed) {
      // keep silent fallback when parsing fails
    }

    const baseOperation: ExplorerOperation = parsed ?? {
      type: normalizedType,
      voteStapleHash: sx(record?.voteStaple?.hash) ?? blockHash,
      block,
      operation: operationPayload.operation,
      operationSend: operationPayload.operationSend,
      operationReceive: operationPayload.operationReceive,
      operationForward: operationPayload.operationForward,
      amount: amountCandidate ?? normalizedRawAmount ?? "0",
      rawAmount: normalizedRawAmount ?? amountCandidate ?? "0",
      formattedAmount:
        operationPayload.formattedAmount ??
        fallbackFormatted ??
        (amountCandidate && amountCandidate.includes(".") ? amountCandidate : normalizedRawAmount) ??
        "0",
      token: operationPayload.token,
      tokenAddress: operationPayload.tokenAddress,
      tokenTicker: operationPayload.tokenTicker,
      tokenDecimals: operationPayload.tokenDecimals,
      tokenMetadata: operationPayload.tokenMetadata,
      from: fallbackFrom ?? (operationPayload.from as string | undefined) ?? "",
      to: fallbackTo ?? (operationPayload.to as string | undefined) ?? "",
      operationType: operationPayload.operationType ?? normalizedType,
    } as ExplorerOperation;

    if (isFeeLike(baseOperation)) {
      return;
    }

    const fromValue =
      (baseOperation.from as string | undefined) ??
      ((baseOperation.operation as any)?.from as string | undefined) ??
      "";
    const toValue =
      (baseOperation.to as string | undefined) ??
      ((baseOperation.operation as any)?.to as string | undefined) ??
      "";

    let finalType = baseOperation.type;
    if (accountKey) {
      if (fromValue && fromValue === accountKey && (!toValue || toValue !== accountKey)) {
        finalType = "SEND";
      } else if (toValue && toValue === accountKey && (!fromValue || fromValue !== accountKey)) {
        finalType = "RECEIVE";
      }
    }

    const rawAmountValue =
      coerceAmountString((baseOperation as any).rawAmount ?? normalizedRawAmount ?? amountCandidate) ?? "";

    const primaryTokenId = fallbackToken ?? undefined;
    let tokenLookupId =
      primaryTokenId ||
      (baseOperation.token as string | undefined) ||
      (baseOperation.tokenAddress as string | undefined) ||
      ((baseOperation.operation as any)?.token as string | undefined) ||
      "";

    if (!tokenLookupId && normalizedTickerCandidate === BASE_TOKEN_TICKER) {
      tokenLookupId = "base";
    }

    if (!tokenLookupId) {
      try {
        if (__DEV__) console.debug("[history] normalizeHistoryRecords missing tokenLookupId", {
          operationType: normalizedType,
          voteStapleHash: sx(record?.voteStaple?.hash) ?? blockHash,
          blockHash,
          rawAmountValue,
          tokenTicker: operationPayload.tokenTicker,
          primaryTokenId,
          operationToken: op.token,
          operationTokenAddress: op.tokenAddress,
          nestedOperationToken: (op.operation as any)?.token,
          fallbackToken,
          fallbackTicker,
          fallbackDecimals,
          metadataFromRecord,
        });
      } catch {}
    }

    const dedupeKey = `${blockHash}|${fromValue}|${toValue}|${tokenLookupId}|${rawAmountValue}`;
    if (seenKeys.has(dedupeKey)) {
      return;
    }
    seenKeys.add(dedupeKey);

    const currentIndex = (blockCounters.get(blockHash) ?? 0) + 1;
    blockCounters.set(blockHash, currentIndex);
    const rowId = `${blockHash}:${currentIndex}`;

    const enriched: ExplorerOperation = { ...baseOperation, type: finalType };
    (enriched as any).rowId = rowId;
    (enriched as any).blockTimestamp = typeof blockTimestampMs === "number" ? blockTimestampMs : (enriched as any).blockTimestamp;
    (enriched as any).tokenLookupId = tokenLookupId || undefined;

    // Additional debug payload to inspect normalization when amounts look unnormalized
    try {
      if (__DEV__) { const debugFmt = {
        voteStapleHash: sx(record?.voteStaple?.hash) ?? blockHash,
        blockHash,
        type: enriched.type,
        token: enriched.token || enriched.tokenAddress || (enriched.operation as any)?.token || null,
        tokenTicker: enriched.tokenTicker,
        tokenDecimals: enriched.tokenDecimals,
        hasFormattedAmount: typeof enriched.formattedAmount === "string" && enriched.formattedAmount.length > 0,
        formattedAmount: enriched.formattedAmount,
        rawAmountValue,
        amountCandidate,
        normalizedRawAmount,
      }; console.debug("[history] enriched operation", debugFmt); }
    } catch {}
    // Prefer page cache, fall back to global cache managed by metadata-service
    let cachedMeta = tokenLookupId ? tokenMetadata[tokenLookupId] : undefined;
    if (!cachedMeta && tokenLookupId) {
      const globalMeta = getGlobalCachedTokenMetadata(tokenLookupId);
      if (globalMeta) {
        cachedMeta = {
          name: globalMeta.name,
          ticker: globalMeta.ticker,
          decimals: globalMeta.decimals,
          fieldType: globalMeta.fieldType,
          metadataBase64: globalMeta.metadataBase64,
        };
      }
    }
    const mergedMeta = mergeTokenMetadata(enriched.tokenMetadata, [metadataFromRecord, cachedMeta]);
    if (mergedMeta) {
      enriched.tokenMetadata = mergedMeta;
      if (!enriched.tokenTicker && mergedMeta.ticker) {
        enriched.tokenTicker = mergedMeta.ticker;
      }
      if (enriched.tokenDecimals === undefined && typeof mergedMeta.decimals === "number") {
        enriched.tokenDecimals = mergedMeta.decimals;
      }
    }

    if (!enriched.formattedAmount && rawAmountValue && enriched.tokenDecimals !== undefined) {
      try {
        const amt = BigInt(rawAmountValue);
        const ticker = enriched.tokenTicker || mergedMeta?.ticker || "UNKNOWN";
        const fieldType = mergedMeta?.fieldType === "decimalPlaces" ? "decimalPlaces" : "decimals";
        enriched.formattedAmount = formatTokenAmount(
          amt,
          enriched.tokenDecimals,
          fieldType,
          ticker || "UNKNOWN",
        );
      } catch {
        // ignore formatting errors
      }
    }

    const hasTokenDecimals = typeof enriched.tokenDecimals === "number";
    const resolvedFieldType = mergedMeta?.fieldType ?? metadataFromRecord?.fieldType ?? fallbackFieldType;

    // If a metadata fetch is pending for this token and we are missing data, skip noisy logs.
    const pendingFetch =
      tokenLookupId &&
      !shouldSkipTokenLookup(tokenLookupId, enriched.tokenTicker) &&
      !tokenMetadata[tokenLookupId];
    const pendingHasTicker = Boolean(enriched.tokenTicker || mergedMeta?.ticker);
    const pendingHasDecimals = typeof (enriched.tokenDecimals ?? mergedMeta?.decimals) === "number";

    if ((!hasTokenDecimals || !resolvedFieldType) && !(pendingFetch && (!pendingHasTicker || !pendingHasDecimals))) {
      const debugPayload = {
        tokenLookupId,
        tokenTicker: enriched.tokenTicker ?? mergedMeta?.ticker ?? operationPayload.tokenTicker,
        hasTokenDecimals,
        resolvedFieldType,
        fallbackDecimals,
        metadataFromRecordDecimals: metadataFromRecord?.decimals,
        cachedMetaDecimals: cachedMeta?.decimals,
        mergedMetaDecimals: mergedMeta?.decimals,
        operationPayloadDecimals: operationPayload.tokenDecimals,
        rawAmountCandidate,
        amountCandidate,
        normalizedRawAmount,
        operationType: enriched.type,
      };

      if (__DEV__) {
        if (!hasTokenDecimals) {
          console.debug("[history] normalizeHistoryRecords missing tokenDecimals", debugPayload);
        }

        if (!resolvedFieldType) {
          console.debug("[history] normalizeHistoryRecords missing fieldType", debugPayload);
        }
      }
    }

    const shouldFetch =
      tokenLookupId &&
      !shouldSkipTokenLookup(tokenLookupId, enriched.tokenTicker) &&
      !tokenMetadata[tokenLookupId];
    const hasTicker = Boolean(enriched.tokenTicker || mergedMeta?.ticker);
    const hasDecimals = typeof (enriched.tokenDecimals ?? mergedMeta?.decimals) === "number";

    if (shouldFetch && (!hasTicker || !hasDecimals)) {
      tokensToFetch.add(tokenLookupId);
    }

    operations.push(enriched);
  };

  for (const record of records) {
    const candidates = gatherRecordOperations(record);
    if (candidates.length > 0) {
      for (const candidate of candidates) {
        processCandidate(candidate, record);
      }
    } else {
      processCandidate(record, record);
    }

    if (Array.isArray((record as any)?.blocks)) {
      for (const block of (record as any).blocks as Array<Record<string, unknown>>) {
        if (!block || typeof block !== "object") {
          continue;
        }

        const blockHash = sx((block as any)?.hash) ?? sx((block as any)?.id) ?? sx(record?.block);
        const blockRecord = {
          ...record,
          block: blockHash ?? record?.block,
          createdAt: (block as any)?.createdAt ?? record?.createdAt,
          timestamp: (block as any)?.timestamp ?? record?.timestamp,
          operations: Array.isArray((block as any)?.operations) ? (block as any)?.operations : [],
        } satisfies WalletHistoryRecord;

        if (Array.isArray(blockRecord.operations) && blockRecord.operations.length > 0) {
          for (const operation of blockRecord.operations) {
            processCandidate(operation, blockRecord);
          }
        }
      }
    }

    if (record.voteStaple && typeof record.voteStaple === "object") {
      const staple = record.voteStaple as {
        operations?: unknown[];
        blocks?: Array<{
          operations?: unknown[];
        }>;
      };

      if (Array.isArray(staple.operations)) {
        for (const operation of staple.operations) {
          processCandidate(operation, record);
        }
      }

      if (Array.isArray(staple.blocks)) {
        for (const block of staple.blocks) {
          if (Array.isArray(block.operations)) {
            for (const operation of block.operations) {
              processCandidate(operation, record);
            }
          }
        }
      }
    }
  }

  return {
    operations,
    tokensToFetch: Array.from(tokensToFetch),
    blocksToFetch: Array.from(blocksToFetch),
  };
}

// Zod schema for validating operations before grouping
const ExplorerOperationGroupingSchema = z.object({
  type: z.string(),
  block: z.object({
    $hash: z.string(),
    date: z.union([z.string(), z.date()]).optional(),
    account: z.string().optional(),
  }).passthrough().nullable().optional(),
  rawAmount: z.union([z.string(), z.number(), z.bigint()]).optional(),
  amount: z.union([z.string(), z.number(), z.bigint()]).optional(),
  formattedAmount: z.string().optional(),
  token: z.string().optional(),
  tokenAddress: z.string().optional(),
  tokenTicker: z.string().optional(),
  tokenDecimals: z.number().optional(),
  tokenMetadata: z.unknown().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  operation: z.unknown().optional(),
  blockTimestamp: z.number().optional(),
  rowId: z.string().optional(),
  tokenLookupId: z.string().optional(),
}).passthrough();

export function groupOperationsByBlock(baseOperations: ExplorerOperation[]): ExplorerOperation[] {
  if (baseOperations.length === 0) {
    return [];
  }

  // Validate operations with Zod before grouping
  const validatedOperations = baseOperations
    .map((op) => {
      const result = ExplorerOperationGroupingSchema.safeParse(op);
      if (!result.success) {
        return null;
      }
      // Additional validation: require either block.$hash or block to be null/undefined for orphans
      if (!op.block || typeof op.block !== "object" || !op.block.$hash) {
        // Orphan operation - allow it
        return op;
      }
      // Must have block.$hash for grouping
      if (typeof op.block.$hash !== "string" || op.block.$hash.length === 0) {
        return null;
      }
      return op;
    })
    .filter((op): op is ExplorerOperation => op !== null);

  const byHash = new Map<string, ExplorerOperation[]>();
  const orphans: ExplorerOperation[] = [];

  for (const op of validatedOperations) {
    const hash =
      (op.block && typeof op.block.$hash === "string" ? op.block.$hash : undefined) ??
      ((op as any)?.hash as string | undefined);
    if (hash) {
      const list = byHash.get(hash) ?? [];
      list.push(op);
      byHash.set(hash, list);
    } else {
      orphans.push(op);
    }
  }

  const result: ExplorerOperation[] = [];

  const toBigInt = (value: unknown): bigint => {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
    if (typeof value === "string" && value.trim().length > 0) {
      try {
        return BigInt(value.trim());
      } catch {
        return BigInt(0);
      }
    }
    return BigInt(0);
  };

  for (const [, ops] of byHash.entries()) {
    if (ops.length <= 1) {
      result.push(ops[0]);
      continue;
    }

    const sums = new Map<string, { sum: bigint; decimals: number; ticker: string; fieldType?: "decimalPlaces" | "decimals" }>();
    let net: bigint = BigInt(0);
    let firstSend: ExplorerOperation | null = null;
    let firstReceive: ExplorerOperation | null = null;
    let latestTimestamp: number | undefined;
    let firstRowId: string | undefined;

    for (const op of ops) {
      const t = (op.type || "").toUpperCase();
      const sign = t === "SEND" ? BigInt(-1) : t === "RECEIVE" ? BigInt(1) : BigInt(0);
      const raw = toBigInt((op as any).rawAmount ?? (op as any).amount ?? ((op as any).operation as any)?.amount);
      const amt = raw * sign;
      net += amt;

      // Preserve blockTimestamp (use latest for sorting)
      const opTimestamp = (op as any).blockTimestamp;
      if (typeof opTimestamp === "number") {
        if (latestTimestamp === undefined || opTimestamp > latestTimestamp) {
          latestTimestamp = opTimestamp;
        }
      }

      // Preserve first rowId for React key
      if (!firstRowId && typeof (op as any).rowId === "string") {
        firstRowId = (op as any).rowId;
      }

      // Prefer a stable lookup id computed during normalization to ensure
      // identical tokens are summed together even if fields differ per op
      let tokenKey = (op as any).tokenLookupId as string | undefined;
      
      // Normalize empty string to undefined
      if (tokenKey === "") {
        tokenKey = undefined;
      }
      
      const opTicker = (op as any).tokenTicker as string | undefined;
      
      // If tokenLookupId is not available, try to construct a consistent key
      if (!tokenKey) {
        // Try to get token address from various fields, normalize them
        const tokenAddress = 
          (op as any).tokenAddress ||
          (op as any).token ||
          ((op as any).operation as any)?.token;
        
        if (tokenAddress && typeof tokenAddress === "string" && tokenAddress.trim().length > 0) {
          // Use the token address as key (normalize to lowercase for consistency)
          tokenKey = tokenAddress.trim().toLowerCase();
        } else if (opTicker && opTicker.toUpperCase() === BASE_TOKEN_TICKER) {
          // Base token (KTA) always uses "base" as key
          tokenKey = "base";
        } else if (opTicker && opTicker.trim().length > 0) {
          // Fallback to ticker-based key if no address available
          tokenKey = `ticker:${opTicker.trim().toUpperCase()}`;
        } else {
          // Last resort: use "unknown" (shouldn't happen in normal flow)
          tokenKey = "unknown";
        }
      }

      const metadata = (op as any).tokenMetadata as Record<string, unknown> | undefined;
      const inferredDecimals = typeof (op as any).tokenDecimals === "number"
        ? (op as any).tokenDecimals
        : typeof metadata?.decimals === "number"
          ? (metadata.decimals as number)
          : undefined;
      const decimals =
        typeof inferredDecimals === "number"
          ? inferredDecimals
          : (tokenKey === "base" ? BASE_TOKEN_DECIMALS : 8);
      const fieldType = (metadata?.fieldType === "decimalPlaces" || metadata?.fieldType === "decimals")
        ? (metadata.fieldType as "decimalPlaces" | "decimals")
        : "decimals";
      const ticker =
        opTicker ||
        (metadata?.ticker as string | undefined) ||
        (tokenKey === "base" ? BASE_TOKEN_TICKER : BASE_TOKEN_TICKER);

      const entry = sums.get(tokenKey) ?? { sum: BigInt(0), decimals, ticker, fieldType };
      entry.sum += amt;
      if (!entry.decimals && decimals) entry.decimals = decimals;
      if (!entry.ticker && ticker) entry.ticker = ticker;
      if (!entry.fieldType && fieldType) entry.fieldType = fieldType;
      sums.set(tokenKey, entry);

      if (sign < BigInt(0) && !firstSend) firstSend = op;
      if (sign > BigInt(0) && !firstReceive) firstReceive = op;
    }

    const parts: string[] = [];
    for (const [, info] of sums) {
      if (info.sum === BigInt(0)) continue;
      const abs = info.sum < BigInt(0) ? -info.sum : info.sum;
      try {
        parts.push(
          formatTokenAmount(
            abs,
            info.decimals || 8,
            info.fieldType ?? "decimals",
            info.ticker || "UNKNOWN",
          ),
        );
      } catch {
        parts.push(`${abs.toString()} ${info.ticker || ""}`.trim());
      }
    }
    const combined = parts.length > 0 
      ? parts.join(" + ") 
      : (() => {
          // If all sums are zero, format as "0" with ticker if available
          const firstToken = ops.find((op) => (op as any).tokenTicker);
          const ticker = firstToken ? ((firstToken as any).tokenTicker || "UNKNOWN") : "UNKNOWN";
          return `0 ${ticker}`;
        })();

    const base = ops[0] as any;
    const synthetic: any = { ...base };
    // When net is zero, default to "Transaction" instead of using base.type
    synthetic.type = net < BigInt(0) ? "SEND" : net > BigInt(0) ? "RECEIVE" : "Transaction";
    synthetic.formattedAmount = combined || base.formattedAmount || base.amount || base.rawAmount || "";

    // Preserve blockTimestamp for sorting
    if (latestTimestamp !== undefined) {
      synthetic.blockTimestamp = latestTimestamp;
    }

    // Preserve rowId for React key (use blockhash-based id if not present)
    if (firstRowId) {
      synthetic.rowId = firstRowId;
    } else {
      const blockHash = base.block?.$hash;
      if (blockHash) {
        synthetic.rowId = `${blockHash}:grouped`;
      }
    }

    // Mark this row as a grouped (combined) summary when there were multiple ops
    if (ops.length > 1) {
      synthetic.groupedCombined = true;
      synthetic.groupedCount = ops.length;
    }

    const pick = net < BigInt(0) ? firstSend : net > BigInt(0) ? firstReceive : ops[0];
    const fromPick = (pick as any)?.from ?? ((pick as any)?.operation as any)?.from;
    const toPick = (pick as any)?.to ?? ((pick as any)?.operation as any)?.to;
    synthetic.from = fromPick;
    synthetic.to = toPick;
    synthetic.operation = { ...(base.operation || {}), from: fromPick, to: toPick };

    if (sums.size > 1) {
      synthetic.tokenMetadata = { name: "Multiple tokens" };
      delete synthetic.tokenTicker;
    } else {
      const single = Array.from(sums.values())[0];
      synthetic.tokenTicker = single?.ticker || synthetic.tokenTicker;
      synthetic.tokenDecimals = typeof single?.decimals === "number" ? single.decimals : synthetic.tokenDecimals;
      if (single?.fieldType) {
        synthetic.tokenMetadata = {
          ...(synthetic.tokenMetadata as Record<string, unknown> | undefined),
          fieldType: single.fieldType,
        };
      }
    }

    result.push(synthetic as ExplorerOperation);
  }

  return [...orphans, ...result].sort((a, b) => {
    // Prefer blockTimestamp for sorting if available
    const at = typeof (a as any)?.blockTimestamp === "number"
      ? (a as any).blockTimestamp
      : ((a as any)?.block?.date ? new Date((a as any).block.date as string).getTime() : 0) || 0;
    const bt = typeof (b as any)?.blockTimestamp === "number"
      ? (b as any).blockTimestamp
      : ((b as any)?.block?.date ? new Date((b as any).block.date as string).getTime() : 0) || 0;
    if (bt !== at) return bt - at;
    // Secondary sort by blockhash for stability (use optional chaining for orphans)
    const ah = (a.block?.$hash || "").toString();
    const bh = (b.block?.$hash || "").toString();
    return bh.localeCompare(ah);
  });
}
