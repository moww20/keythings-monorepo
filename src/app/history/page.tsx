"use client";

import React from "react";
import { coerceString as sx, resolveDate } from "@/lib/explorer/mappers";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import ExplorerOperationsTable from "@/app/explorer/components/ExplorerOperationsTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { ExplorerOperation } from "@/lib/explorer/client";
import { parseExplorerOperation } from "@/lib/explorer/client";
import { parseTokenMetadata, formatTokenAmount } from "@/app/explorer/utils/token-metadata";
import { getTokenMeta } from "@/lib/tokens/metadata-service";
import { useWallet } from "@/app/contexts/WalletContext";

const BASE_TOKEN_TICKER = "KTA";
const FALLBACK_MESSAGE = "Connect your Keeta wallet to pull on-chain activity.";
const INITIAL_PAGE_DEPTH = 20;
const SUBSEQUENT_PAGE_DEPTH = 40;

type CachedTokenMeta = {
  name?: string | null;
  ticker?: string | null;
  decimals?: number | null;
  fieldType?: "decimalPlaces" | "decimals";
  metadataBase64?: string | null;
};

interface BaseNormalizedOperation {
  operation: ExplorerOperation;
  metadataFromRecord?: CachedTokenMeta;
  tokenLookupId?: string;
}

interface NormalizedHistoryResult {
  operations: BaseNormalizedOperation[];
}

type HistoryQueryPageParam = {
  cursor: string | null;
  depth: number;
};

function shouldSkipTokenLookup(tokenId?: string | null, ticker?: string | null): boolean {
  if (!tokenId) return true;
  if (tokenId.startsWith("PLACEHOLDER_")) return true;
  if (tokenId === "base") return true;
  if (ticker && ticker.toUpperCase() === BASE_TOKEN_TICKER) return true;
  return false;
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

function normalizeHistoryRecords(records: any[], account: string): NormalizedHistoryResult {
  if (!records.length) {
    return { operations: [] };
  }

  const operations: BaseNormalizedOperation[] = [];
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

    const fallbackAmount = sx(op.amount ?? op.rawAmount) ?? sx(record.amount ?? record.rawAmount);
    const fallbackToken = sx(op.token ?? op.tokenAddress) ?? sx(record.token ?? record.tokenAddress);
    const fallbackFrom = sx(op.from) ?? sx(record.from ?? record.account);
    const fallbackTo = sx(op.to ?? op.toAccount) ?? sx(record.to);
    const fallbackFormatted = sx(op.formattedAmount) ?? sx(record.formattedAmount);
    const fallbackTicker = sx(op.tokenTicker) ?? sx(record.tokenTicker);
    const fallbackDecimals = typeof (op.tokenDecimals ?? record.tokenDecimals) === "number"
      ? Number(op.tokenDecimals ?? record.tokenDecimals)
      : undefined;
    const fallbackMetadata = op.tokenMetadata ?? record.tokenMetadata ?? record.metadata;

    const block = {
      $hash: blockHash,
      date: resolveDate(op.date, record?.date, record?.createdAt, record?.timestamp),
      account: sx(op.account ?? record?.account ?? record?.from),
    };

    const operationPayload: Record<string, any> = {
      type: normalizedType,
      voteStapleHash: sx(record?.voteStaple?.hash) ?? blockHash,
      block,
      operation: { ...op },
      amount: fallbackAmount ?? sx(op.amount),
      rawAmount: fallbackAmount ?? sx(op.rawAmount ?? op.amount),
      formattedAmount: fallbackFormatted ?? sx(op.formattedAmount),
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
      } catch {}
    }

    const parsed = parseExplorerOperation(operationPayload);
    if (!parsed || isFeeLike(parsed)) {
      return;
    }

    const fromValue =
      (parsed.from as string | undefined) ??
      ((parsed.operation as any)?.from as string | undefined) ??
      "";
    const toValue =
      (parsed.to as string | undefined) ??
      ((parsed.operation as any)?.to as string | undefined) ??
      "";

    let finalType = parsed.type;
    if (accountKey) {
      if (fromValue && fromValue === accountKey && (!toValue || toValue !== accountKey)) {
        finalType = "SEND";
      } else if (toValue && toValue === accountKey && (!fromValue || fromValue !== accountKey)) {
        finalType = "RECEIVE";
      }
    }

    const rawAmountValue = sx((parsed as any).rawAmount ?? (parsed as any).amount) ?? "";

    const primaryTokenId = fallbackToken ?? undefined;
    const tokenLookupId =
      primaryTokenId ||
      (parsed.token as string | undefined) ||
      (parsed.tokenAddress as string | undefined) ||
      ((parsed.operation as any)?.token as string | undefined) ||
      "";

    const dedupeKey = `${blockHash}|${fromValue}|${toValue}|${tokenLookupId}|${rawAmountValue}`;
    if (seenKeys.has(dedupeKey)) {
      return;
    }
    seenKeys.add(dedupeKey);

    const enriched: ExplorerOperation = { ...parsed, type: finalType };
    const mergedMeta = mergeTokenMetadata(enriched.tokenMetadata, [metadataFromRecord]);
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
      } catch {}
    }

    operations.push({
      operation: enriched,
      metadataFromRecord,
      tokenLookupId: tokenLookupId || undefined,
    });
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
  }

  return { operations };
}

function hydrateNormalizedOperations(
  baseOperations: BaseNormalizedOperation[],
  tokenMetadata: Record<string, CachedTokenMeta>,
): { operations: ExplorerOperation[]; tokensToFetch: string[] } {
  if (!baseOperations.length) {
    return { operations: [], tokensToFetch: [] };
  }

  const tokensToFetch = new Set<string>();
  const operations: ExplorerOperation[] = [];

  for (const entry of baseOperations) {
    const base = { ...entry.operation } as ExplorerOperation;
    const lookupId = entry.tokenLookupId;
    const cachedMeta = lookupId ? tokenMetadata[lookupId] : undefined;
    const metadataCandidates: Array<CachedTokenMeta | undefined> = [entry.metadataFromRecord];
    if (cachedMeta) {
      metadataCandidates.push(cachedMeta);
    }

    const mergedMeta = mergeTokenMetadata(base.tokenMetadata, metadataCandidates);
    if (mergedMeta) {
      base.tokenMetadata = mergedMeta;
      if (!base.tokenTicker && mergedMeta.ticker) {
        base.tokenTicker = mergedMeta.ticker;
      }
      if (base.tokenDecimals === undefined && typeof mergedMeta.decimals === "number") {
        base.tokenDecimals = mergedMeta.decimals;
      }
    }

    const rawAmountValue =
      sx((base as any).rawAmount ?? (base as any).amount) ??
      sx(((base as any).operation as any)?.amount) ??
      "";

    if (!base.formattedAmount && rawAmountValue) {
      const decimalsToUse = base.tokenDecimals ?? mergedMeta?.decimals;
      if (typeof decimalsToUse === "number") {
        try {
          const amt = BigInt(rawAmountValue);
          const ticker = base.tokenTicker || mergedMeta?.ticker || "UNKNOWN";
          const fieldType = mergedMeta?.fieldType === "decimalPlaces" ? "decimalPlaces" : "decimals";
          base.formattedAmount = formatTokenAmount(amt, decimalsToUse, fieldType, ticker || "UNKNOWN");
        } catch {}
      }
    }

    const shouldFetch = Boolean(lookupId) && !shouldSkipTokenLookup(lookupId, base.tokenTicker);
    const hasTicker = Boolean(base.tokenTicker || mergedMeta?.ticker);
    const hasDecimals = typeof (base.tokenDecimals ?? mergedMeta?.decimals) === "number";

    if (shouldFetch && (!hasTicker || !hasDecimals)) {
      tokensToFetch.add(lookupId!);
    }

    operations.push(base);
  }

  return { operations, tokensToFetch: Array.from(tokensToFetch) };
}

function groupOperationsByBlock(baseOperations: ExplorerOperation[]): ExplorerOperation[] {
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

export default function HistoryPage(): React.JSX.Element {
  const { publicKey } = useWallet();
  const [isClient, setIsClient] = React.useState(false);
  const [tokenMetadata, setTokenMetadata] = React.useState<Record<string, CachedTokenMeta>>({});
  const fetchingTokenMetaRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const accountKey = React.useMemo(
    () => (typeof publicKey === "string" ? publicKey : ""),
    [publicKey],
  );

  React.useEffect(() => {
    setTokenMetadata({});
    fetchingTokenMetaRef.current.clear();
  }, [accountKey]);

  const historyQuery = useInfiniteQuery<
    { records: any[]; cursor: string | null; hasMore: boolean },
    Error,
    InfiniteData<{ records: any[]; cursor: string | null; hasMore: boolean }, HistoryQueryPageParam>,
    [string, string],
    HistoryQueryPageParam
  >({
    queryKey: ["history", accountKey],
    queryFn: async ({ pageParam }) => {
      const params: HistoryQueryPageParam =
        pageParam && typeof pageParam === "object"
          ? {
              cursor: typeof (pageParam as HistoryQueryPageParam).cursor === "string"
                ? (pageParam as HistoryQueryPageParam).cursor
                : null,
              depth: (() => {
                const raw = Number((pageParam as HistoryQueryPageParam).depth);
                if (Number.isFinite(raw) && raw > 0) {
                  return Math.min(SUBSEQUENT_PAGE_DEPTH, Math.max(1, Math.round(raw)));
                }
                return INITIAL_PAGE_DEPTH;
              })(),
            }
          : { cursor: null, depth: INITIAL_PAGE_DEPTH };

      if (typeof window === "undefined" || !window.keeta?.history) {
        return { records: [], cursor: null, hasMore: false } as {
          records: any[];
          cursor: string | null;
          hasMore: boolean;
        };
      }
      try {
        if (typeof window.keeta.requestCapabilities === "function") {
          await window.keeta.requestCapabilities(["read"]);
        }
      } catch {}

      const resp = await window.keeta.history({
        depth: params.depth,
        cursor: params.cursor,
        includeOperations: true,
        includeTokenMetadata: true,
      } as any);

      let records: any[] = Array.isArray(resp?.records) ? resp.records : [];

      try {
        const uc: any = await window.keeta.getUserClient?.();
        const hasFilter = uc && (typeof uc.filterStapleOperations === "function" || typeof uc.filterStapleOps === "function");
        if (hasFilter && accountKey) {
          const applyStapleFilter = async (rec: any) => {
            if (!rec || typeof rec !== "object") return rec;
            const staple = (rec as any).voteStaple;
            if (!staple) return rec;
            try {
              let filtered: any;
              if (typeof uc.filterStapleOperations === "function") {
                filtered = await uc.filterStapleOperations(staple, { account: accountKey });
              } else if (typeof uc.filterStapleOps === "function") {
                filtered = await uc.filterStapleOps(staple, { account: accountKey });
              }
              if (Array.isArray(filtered)) {
                (rec as any).operations = filtered;
              } else if (filtered && Array.isArray(filtered.operations)) {
                (rec as any).operations = filtered.operations;
              }
            } catch {}
            return rec;
          };

          records = await Promise.all(records.map((rec) => applyStapleFilter(rec)));
        }
      } catch {}

      return {
        records,
        cursor: typeof resp?.cursor === "string" ? resp.cursor : null,
        hasMore: Boolean(resp?.hasMore),
      } as { records: any[]; cursor: string | null; hasMore: boolean };
    },
    initialPageParam: { cursor: null as string | null, depth: INITIAL_PAGE_DEPTH } satisfies HistoryQueryPageParam,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore
        ? ({ cursor: lastPage.cursor, depth: SUBSEQUENT_PAGE_DEPTH } satisfies HistoryQueryPageParam)
        : undefined,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: isClient && accountKey.length > 0,
  });

  const { data, fetchNextPage, hasNextPage = false, isFetchingNextPage = false, isLoading, isError } = historyQuery;

  const pages = React.useMemo(() => data?.pages ?? [], [data]);
  const allRecords = React.useMemo(() => {
    const collected: any[] = [];
    for (const page of pages) {
      if (Array.isArray(page?.records)) {
        collected.push(...page.records);
      }
    }
    return collected;
  }, [pages]);

  const normalized = React.useMemo(
    () => normalizeHistoryRecords(allRecords, accountKey),
    [allRecords, accountKey],
  );

  const hydrated = React.useMemo(
    () => hydrateNormalizedOperations(normalized.operations, tokenMetadata),
    [normalized.operations, tokenMetadata],
  );

  React.useEffect(() => {
    if (!hydrated.tokensToFetch.length) {
      return;
    }

    for (const tokenId of hydrated.tokensToFetch) {
      if (!tokenId) continue;
      if (tokenMetadata[tokenId]) continue;
      if (fetchingTokenMetaRef.current.has(tokenId)) continue;
      fetchingTokenMetaRef.current.add(tokenId);

      void (async () => {
        try {
          const meta = await getTokenMeta(tokenId);
          if (meta) {
            const normalizedMeta: CachedTokenMeta = {
              name: typeof meta.name === "string" ? meta.name : undefined,
              ticker: typeof meta.ticker === "string" ? meta.ticker : undefined,
              decimals: typeof meta.decimals === "number" ? meta.decimals : undefined,
              metadataBase64: typeof meta.metadataBase64 === "string" ? meta.metadataBase64 : undefined,
            };

            if (normalizedMeta.metadataBase64) {
              const parsed = parseTokenMetadata(normalizedMeta.metadataBase64);
              if (parsed?.fieldType === "decimalPlaces" || parsed?.fieldType === "decimals") {
                normalizedMeta.fieldType = parsed.fieldType;
              }
              if (typeof parsed?.decimals === "number" && normalizedMeta.decimals === undefined) {
                normalizedMeta.decimals = parsed.decimals;
              }
              if (!normalizedMeta.ticker && typeof parsed?.ticker === "string") {
                normalizedMeta.ticker = parsed.ticker;
              }
              if (!normalizedMeta.name && typeof parsed?.name === "string") {
                normalizedMeta.name = parsed.name;
              }
            }

            if (!normalizedMeta.fieldType && typeof normalizedMeta.decimals === "number") {
              normalizedMeta.fieldType = "decimals";
            }
            setTokenMetadata((prev) => {
              if (prev[tokenId]) {
                return prev;
              }
              return { ...prev, [tokenId]: normalizedMeta };
            });
          }
        } catch {}
        finally {
          fetchingTokenMetaRef.current.delete(tokenId);
        }
      })();
    }
  }, [hydrated.tokensToFetch, tokenMetadata]);

  const groupedOperations = React.useMemo(
    () => groupOperationsByBlock(hydrated.operations),
    [hydrated.operations],
  );

  const awaitingWallet = isClient && accountKey.length === 0;
  const hasAnyRecords = groupedOperations.length > 0;
  const tableLoading = !awaitingWallet && (!isClient || (isLoading && !hasAnyRecords));
  const errorMessage = awaitingWallet ? FALLBACK_MESSAGE : isError ? FALLBACK_MESSAGE : null;

  const handleLoadMore = React.useCallback(async () => {
    if (!hasNextPage) return;
    await fetchNextPage();
  }, [hasNextPage, fetchNextPage]);

  return (
    <div className="h-screen bg-background">
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties}
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <div className="flex h-full flex-col overflow-hidden">
            <div className="@container/main flex h-full flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6 overflow-hidden">
              <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-foreground">History</h1>
                <Badge variant="outline" className="text-xs text-muted">On-chain</Badge>
              </header>

              <div className="flex flex-1 flex-col overflow-hidden">
                {errorMessage ? (
                  <div className="flex h-full items-center justify-center rounded-xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-8 text-sm text-muted">
                    {errorMessage}
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                    <div className="shrink-0">
                      <ExplorerOperationsTable
                        operations={groupedOperations}
                        participantsMode="smart"
                        loading={tableLoading}
                        emptyLabel={"No history found."}
                      />
                    </div>
                    {hasNextPage && (
                      <div className="shrink-0 flex justify-center pb-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-4"
                          onClick={handleLoadMore}
                          disabled={isFetchingNextPage}
                        >
                          {isFetchingNextPage ? "Loading…" : "Load more"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
