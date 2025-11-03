import { z } from "zod";

import { coerceString as sx, resolveDate } from "@/lib/explorer/mappers";
import { parseExplorerOperation } from "@/lib/explorer/client";
import { parseTokenMetadata, formatTokenAmount } from "@/app/explorer/utils/token-metadata";
import type { ExplorerOperation } from "@/lib/explorer/client";
import type { WalletHistoryRecord } from "@/app/lib/wallet-history";
import type { KeetaProvider } from "@/types/keeta";

export const BASE_TOKEN_TICKER = "KTA";

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

  const requestPayload: { depth: number; cursor?: string } = {
    depth: Math.max(1, options.depth),
  };
  if (options.cursor) {
    requestPayload.cursor = options.cursor;
  }

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

    const block = {
      $hash: blockHash,
      date: fallbackDate,
      account: blockAccountValue,
      placeholderDate: isPlaceholderDate,
    };

    if (isPlaceholderDate) {
      blocksToFetch.add(blockHash);
    }

    const operationPayload: Record<string, any> = {
      type: normalizedType,
      voteStapleHash: sx(record?.voteStaple?.hash) ?? blockHash,
      block,
      operation: { ...op },
      amount: amountCandidate ?? coerceAmountString(op.amount),
      rawAmount: normalizedRawAmount,
      formattedAmount: fallbackFormatted ?? sx(op.formattedAmount) ?? (amountCandidate && amountCandidate.includes(".") ? amountCandidate : undefined),
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

    const metadataFromRecord = normalizeMetadataCandidate(fallbackMetadata);
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

    if (
      !operationPayload.formattedAmount &&
      operationPayload.rawAmount &&
      operationPayload.tokenDecimals !== undefined
    ) {
      try {
        const amt = BigInt(operationPayload.rawAmount as string);
        const ticker = operationPayload.tokenTicker || metadataFromRecord?.ticker || "UNKNOWN";
        const fieldType = metadataFromRecord?.fieldType === "decimalPlaces" ? "decimalPlaces" : "decimals";
        operationPayload.formattedAmount = formatTokenAmount(
          amt,
          operationPayload.tokenDecimals,
          fieldType,
          ticker,
        );
      } catch {
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
    const tokenLookupId =
      primaryTokenId ||
      (baseOperation.token as string | undefined) ||
      (baseOperation.tokenAddress as string | undefined) ||
      ((baseOperation.operation as any)?.token as string | undefined) ||
      "";

    if (!tokenLookupId) {
      try {
        console.debug("[history] normalizeHistoryRecords missing tokenLookupId", {
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

    const enriched: ExplorerOperation = { ...baseOperation, type: finalType };
    const cachedMeta = tokenLookupId ? tokenMetadata[tokenLookupId] : undefined;
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
    if (!hasTokenDecimals || !resolvedFieldType) {
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

      if (!hasTokenDecimals) {
        console.debug("[history] normalizeHistoryRecords missing tokenDecimals", debugPayload);
      }

      if (!resolvedFieldType) {
        console.debug("[history] normalizeHistoryRecords missing fieldType", debugPayload);
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

export function groupOperationsByBlock(baseOperations: ExplorerOperation[]): ExplorerOperation[] {
  if (baseOperations.length === 0) {
    return [];
  }

  const byHash = new Map<string, ExplorerOperation[]>();
  const orphans: ExplorerOperation[] = [];

  for (const op of baseOperations) {
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

    for (const op of ops) {
      const t = (op.type || "").toUpperCase();
      const sign = t === "SEND" ? BigInt(-1) : t === "RECEIVE" ? BigInt(1) : BigInt(0);
      const raw = toBigInt((op as any).rawAmount ?? (op as any).amount ?? ((op as any).operation as any)?.amount);
      const amt = raw * sign;
      net += amt;

      const tokenKey =
        (op as any).token ||
        (op as any).tokenAddress ||
        ((op as any).operation as any)?.token ||
        (op as any).tokenTicker ||
        BASE_TOKEN_TICKER;
      const metadata = (op as any).tokenMetadata as Record<string, unknown> | undefined;
      const decimals = typeof (op as any).tokenDecimals === "number"
        ? (op as any).tokenDecimals
        : typeof metadata?.decimals === "number"
          ? (metadata.decimals as number)
          : 8;
      const fieldType = (metadata?.fieldType === "decimalPlaces" || metadata?.fieldType === "decimals")
        ? (metadata.fieldType as "decimalPlaces" | "decimals")
        : "decimals";
      const ticker =
        (op as any).tokenTicker ||
        (metadata?.ticker as string | undefined) ||
        BASE_TOKEN_TICKER;

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
    const combined = parts.join(" + ");

    const base = ops[0] as any;
    const synthetic: any = { ...base };
    synthetic.type = net < BigInt(0) ? "SEND" : net > BigInt(0) ? "RECEIVE" : base.type || "Transaction";
    synthetic.formattedAmount = combined || base.formattedAmount || base.amount || base.rawAmount || "";

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
    const ta = (a as any)?.block?.date ? new Date((a as any).block.date as string).getTime() : 0;
    const tb = (b as any)?.block?.date ? new Date((b as any).block.date as string).getTime() : 0;
    return tb - ta;
  });
}
