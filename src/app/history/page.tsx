"use client";

import React from "react";
import { coerceString as sx, resolveDate } from "@/lib/explorer/mappers";
import { useInfiniteQuery } from "@tanstack/react-query";
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
// Provider-only history path (remove SDK/raw fallback)

const BASE_TOKEN_TICKER = "KTA";
const FALLBACK_MESSAGE = "Connect your Keeta wallet to pull on-chain activity.";

type CachedTokenMeta = {
  name?: string | null;
  ticker?: string | null;
  decimals?: number | null;
  fieldType?: "decimalPlaces" | "decimals";
  metadataBase64?: string | null;
};

interface NormalizedHistoryResult {
  operations: ExplorerOperation[];
  tokensToFetch: string[];
}

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

function normalizeHistoryRecords(
  records: any[],
  account: string,
  tokenMetadata: Record<string, CachedTokenMeta>,
): NormalizedHistoryResult {
  if (!records.length) {
    return { operations: [], tokensToFetch: [] };
  }

  const operations: ExplorerOperation[] = [];
  const tokensToFetch = new Set<string>();
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
    const fallbackFrom = sx(op.from) ?? sx(op.account) ?? sx(record.from ?? record.account);
    const fallbackTo = sx(op.to ?? op.toAccount) ?? sx(record.to);
    const fallbackFormatted = sx(op.formattedAmount) ?? sx(record.formattedAmount);
    const fallbackTicker = sx(op.tokenTicker) ?? sx(record.tokenTicker);
    const fallbackDecimals = typeof (op.tokenDecimals ?? record.tokenDecimals) === "number"
      ? Number(op.tokenDecimals ?? record.tokenDecimals)
      : undefined;
    const fallbackMetadata = op.tokenMetadata ?? record.tokenMetadata ?? record.metadata;

    const blockAccountValue =
      sx(op.account) ?? sx(record?.account) ?? sx(record?.from) ?? accountKey;
    let block = {
      $hash: blockHash,
      date: resolveDate(
        op.date,
        op.block?.date,
        (op.block as any)?.createdAt,
        record?.date,
        record?.createdAt,
        record?.timestamp,
        (record?.block as any)?.date,
        (record?.block as any)?.createdAt,
      ),
      account: blockAccountValue,
    };
    if (!block.date || (typeof block.date === 'string' && block.date.trim().length === 0)) {
      block = { ...block, date: new Date().toISOString() };
    }

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
      } catch {}
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
  const { publicKey, wallet } = useWallet();
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

  const historyQuery = useInfiniteQuery({
    queryKey: ["history", accountKey],
    queryFn: async ({ pageParam }) => {
      const depth = 50;
      if (!accountKey) {
        return { records: [], cursor: null, hasMore: false } as { records: any[]; cursor: string | null; hasMore: boolean };
      }
      // Provider-only: use wallet extension history to derive operations
      if (typeof window === "undefined" || !(window as any)?.keeta?.history) {
        return { records: [], cursor: null, hasMore: false } as { records: any[]; cursor: string | null; hasMore: boolean };
      }

      const prov = await (window as any).keeta.history({ depth });
      const recs = prov && typeof prov === "object" && Array.isArray((prov as any).records) ? (prov as any).records : null;
      if (!Array.isArray(recs) || recs.length === 0) {
        return { records: [], cursor: null, hasMore: false } as { records: any[]; cursor: string | null; hasMore: boolean };
      }

      const extracted: any[] = [];
      const toStringSafe = (val: unknown): string | undefined => {
        if (typeof val === "string") return val;
        if (val && typeof (val as { toString?: () => string }).toString === "function") {
          try {
            const s = (val as { toString: () => string }).toString();
            if (typeof s === "string" && s !== "[object Object]") return s;
          } catch {}
        }
        return undefined;
      };
      const accountToString = (candidate: unknown): string | undefined => {
        if (typeof candidate === "string") return candidate;
        if (candidate && typeof candidate === "object") {
          const obj = candidate as Record<string, unknown>;
          const pk = obj.publicKeyString as unknown;
          if (typeof pk === "string" && pk.trim().length > 0) return pk;
          if (pk && typeof (pk as { get?: () => unknown }).get === "function") {
            try {
              const got = (pk as { get: () => unknown }).get();
              if (typeof got === "string" && got.trim().length > 0) return got;
              if (got && typeof (got as { toString?: () => string }).toString === "function") {
                const s = (got as { toString: () => string }).toString();
                if (typeof s === "string" && s !== "[object Object]") return s;
              }
            } catch {}
          }
          if (pk && typeof (pk as { toString?: () => string }).toString === "function") {
            try {
              const s = (pk as { toString: () => string }).toString();
              if (typeof s === "string" && s !== "[object Object]") return s;
            } catch {}
          }
        }
        return toStringSafe(candidate);
      };
      const normalizeOpType = (value: unknown): string => {
        const map: Record<number, string> = {
          0: 'SEND',
          1: 'RECEIVE',
          2: 'SWAP',
          3: 'SWAP_FORWARD',
          4: 'TOKEN_ADMIN_SUPPLY',
          5: 'TOKEN_ADMIN_MODIFY_BALANCE',
        };
        if (typeof value === 'number' && value in map) return map[value];
        if (typeof value === 'string') {
          const n = Number(value);
          if (Number.isInteger(n) && n in map) return map[n];
          return value.toUpperCase();
        }
        return 'UNKNOWN';
      };
      for (const entry of recs as any[]) {
        const blocks = Array.isArray((entry as any)?.blocks) ? (entry as any).blocks : [];
        const stapleDateIso = (() => {
          const raw = (entry as any)?.date ?? (entry as any)?.createdAt ?? (entry as any)?.timestamp;
          if (raw instanceof Date) return raw.toISOString();
          if (typeof raw === "number") {
            const ms = raw < 1_000_000_000_000 ? raw * 1000 : raw;
            return new Date(ms).toISOString();
          }
          if (typeof raw === "string") return raw;
          return undefined;
        })();
        for (const block of blocks as any[]) {
          const list = Array.isArray(block?.operations) ? block.operations : Array.isArray(block?.transactions) ? block.transactions : [];
          const blockHash = typeof block?.hash === "string" ? block.hash : toStringSafe(block?.hash);
          const bdateRaw = (block?.createdAt ?? block?.date ?? stapleDateIso) as unknown;
          const blockDate = (() => {
            if (bdateRaw instanceof Date) return bdateRaw.toISOString();
            if (typeof bdateRaw === "number") {
              const ms = bdateRaw < 1_000_000_000_000 ? bdateRaw * 1000 : bdateRaw;
              return new Date(ms).toISOString();
            }
            if (typeof bdateRaw === "string") return bdateRaw;
            return undefined;
          })();
          const blockAccount = accountToString((block as any)?.account);
          for (const raw of list) {
            const rec = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
            const type = normalizeOpType(rec.type);
            const from = accountToString(rec.from ?? rec.sender ?? undefined);
            const to = accountToString(rec.to ?? rec.receiver ?? undefined);
            const initialTokenCandidate = rec.token ?? rec.tokenAddress ?? rec.account ?? rec.target ?? rec.asset ?? rec.currency;
            const token = accountToString(initialTokenCandidate ?? undefined);
            const amt = rec.amount as unknown;
            let amount: string | undefined;
            if (typeof amt === "bigint") amount = amt.toString();
            else if (typeof amt === "number") amount = Math.trunc(amt).toString();
            else if (typeof amt === "string") amount = amt;

            const rawOperation = rec;
            const entry: Record<string, any> = {
              type,
              operationType: type,
              from,
              to,
              token,
              tokenAddress: token,
              amount: amount ?? "0",
              rawAmount: amount ?? "0",
              block: blockHash,
              date: blockDate,
              account: blockAccount,
              rawOperation,
            };

            if (rawOperation && typeof rawOperation === "object") {
              const deriveTokenFromRaw = (): string | undefined => {
                const candidate =
                  rawOperation.token ??
                  rawOperation.tokenAddress ??
                  (rawOperation as any)?.operationSend?.token ??
                  (rawOperation as any)?.operationReceive?.token ??
                  (rawOperation as any)?.operationForward?.token ??
                  (rawOperation as any)?.asset ??
                  (rawOperation as any)?.currency ??
                  (rawOperation as any)?.account ??
                  (rawOperation as any)?.target;
                return accountToString(candidate);
              };

              const derivedToken = deriveTokenFromRaw();
              if (!entry.token && derivedToken) {
                entry.token = derivedToken;
                entry.tokenAddress = derivedToken;
              }

              const copyString = (value: unknown): string | undefined =>
                typeof value === "string" && value.trim().length > 0 ? value : undefined;

              const copyObject = (value: unknown): Record<string, unknown> | undefined =>
                value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;

              entry.operationSend = copyObject((rawOperation as any)?.operationSend);
              entry.operationReceive = copyObject((rawOperation as any)?.operationReceive);
              entry.operationForward = copyObject((rawOperation as any)?.operationForward);

              if (!entry.formattedAmount) {
                entry.formattedAmount = copyString((rawOperation as any)?.formattedAmount);
              }
              if (!entry.tokenTicker) {
                entry.tokenTicker = copyString((rawOperation as any)?.tokenTicker);
              }
              if (!entry.tokenMetadata && (rawOperation as any)?.tokenMetadata) {
                entry.tokenMetadata = (rawOperation as any)?.tokenMetadata;
              }
              if (!entry.tokenDecimals && typeof (rawOperation as any)?.tokenDecimals === "number") {
                entry.tokenDecimals = (rawOperation as any)?.tokenDecimals;
              }
            }

            extracted.push(entry);
          }
        }
      }
      const records = extracted.length > 0 ? [{ operations: extracted }] : [];
      return { records, cursor: null, hasMore: false } as { records: any[]; cursor: string | null; hasMore: boolean };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: isClient && accountKey.length > 0,
  });

  // Proactively refetch once the wallet connects and account key is present
  const { data, fetchNextPage, hasNextPage = false, isFetchingNextPage = false, isLoading, isError, refetch } = historyQuery;

  // Remove extra refetch effect to avoid duplicate queries/race conditions.

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
    () => normalizeHistoryRecords(allRecords, accountKey, tokenMetadata),
    [allRecords, accountKey, tokenMetadata],
  );

  React.useEffect(() => {
    if (!normalized.tokensToFetch.length) {
      return;
    }

    for (const tokenId of normalized.tokensToFetch) {
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
  }, [normalized.tokensToFetch, tokenMetadata]);

  const groupedOperations = React.useMemo(
    () => groupOperationsByBlock(normalized.operations),
    [normalized.operations],
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
                        emptyLabel="No history found."
                        pageSize={10}
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
