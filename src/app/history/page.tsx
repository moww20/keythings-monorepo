"use client";

import React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import ExplorerOperationsTable from "@/app/explorer/components/ExplorerOperationsTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { ExplorerOperation } from "@/lib/explorer/client";
import { parseTokenMetadata, formatTokenAmount } from "@/app/explorer/utils/token-metadata";
import { getTokenMeta } from "@/lib/tokens/metadata-service";
import { useWallet } from "@/app/contexts/WalletContext";

type HistoryCacheEntry = {
  operations: ExplorerOperation[];
  cursor: string | null;
  hasMore: boolean;
  seenKeys: string[];
};

const historyCache = new Map<string, HistoryCacheEntry>();

// Fallback text when wallet history is unavailable
const FALLBACK_MESSAGE = "Connect your Keeta wallet to pull on-chain activity.";

// Lightweight helpers (mirroring ExplorerRecentActivityCard)
function sx(v: unknown): string | undefined {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : undefined;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  if (typeof v === "bigint") return String(v);
  return undefined;
}

function resolveDate(...cands: unknown[]): string {
  for (const c of cands) {
    if (c instanceof Date && !Number.isNaN(c.getTime())) return c.toISOString();
    if (typeof c === "number" && Number.isFinite(c)) {
      const d = new Date(c);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    if (typeof c === "string") {
      const d = new Date(c);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return new Date().toISOString();
}

export default function HistoryPage(): React.JSX.Element {
  const { publicKey } = useWallet();
  const [isClient, setIsClient] = React.useState(false);
  const [operations, setOperations] = React.useState<ExplorerOperation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState<boolean>(false);
  const [pageIndex, setPageIndex] = React.useState(0);

  const PAGE_SIZE = 10;

  // Local set to avoid duplicate in-flight getTokenMeta calls (in addition to service cache)
  const fetchingTokenMetaRef = React.useRef<Set<string>>(new Set());
  const seenKeysRef = React.useRef<Set<string>>(new Set());
  const pendingInitialFetchRef = React.useRef(false);

  const cacheKey = React.useMemo(() => (typeof publicKey === 'string' ? publicKey.toLowerCase() : null), [publicKey]);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const applyTokenInfoToOperations = React.useCallback((tokenId: string, info: { name?: string | null; ticker?: string | null; decimals?: number | null; metadataBase64?: string | null; }) => {
    setOperations((prev) => {
      let changed = false;
      const next = prev.map((op) => {
        const opToken = (op.token || op.tokenAddress || op.operation?.token) as string | undefined;
        if (!opToken || opToken !== tokenId) {
          return op;
        }
        const updated: ExplorerOperation = { ...op } as any;
        // Merge tokenMetadata
        const baseMetaObj = (updated.tokenMetadata && typeof updated.tokenMetadata === 'object') ? (updated.tokenMetadata as any) : {};
        const normalizedMeta: any = {
          ...baseMetaObj,
          name: typeof info.name === 'string' ? info.name : (updated.tokenMetadata as any)?.name,
          ticker: typeof info.ticker === 'string' ? info.ticker : (updated.tokenMetadata as any)?.ticker,
          decimals: typeof info.decimals === 'number' ? info.decimals : (updated.tokenMetadata as any)?.decimals,
        };
        updated.tokenMetadata = normalizedMeta;
        if (!updated.tokenTicker && normalizedMeta.ticker) {
          updated.tokenTicker = normalizedMeta.ticker;
        }
        if (!updated.tokenDecimals && typeof normalizedMeta.decimals === 'number') {
          updated.tokenDecimals = normalizedMeta.decimals;
        }
        // Compute formattedAmount if missing and amount available
        const amountStr = (updated.rawAmount ?? updated.amount) as string | undefined;
        if (!updated.formattedAmount && amountStr && typeof updated.tokenDecimals === 'number') {
          try {
            updated.formattedAmount = formatTokenAmount(BigInt(amountStr), updated.tokenDecimals, 'decimals', updated.tokenTicker || 'UNKNOWN');
          } catch {}
        }
        changed = true;
        return updated;
      });
      return changed ? next : prev;
    });
  }, []);

  const fetchAndApplyTokenMetadata = React.useCallback(async (tokenId: string) => {
    if (!tokenId) return;
    if (fetchingTokenMetaRef.current.has(tokenId)) return;
    fetchingTokenMetaRef.current.add(tokenId);
    try {
      const meta = await getTokenMeta(tokenId);
      if (!meta) return;
      applyTokenInfoToOperations(tokenId, meta);
    } finally {
      fetchingTokenMetaRef.current.delete(tokenId);
    }
  }, [applyTokenInfoToOperations]);

  const appendFromRecords = React.useCallback((records: any[]): number => {
    // Convert a variety of record formats into ExplorerOperation using
    // the same tolerant approach as ExplorerRecentActivityCard
    const collected: ExplorerOperation[] = [];
    const seen = new Set<string>();

    const isFeeLike = (op: any): boolean => {
      const t1 = typeof op?.operationType === 'string' ? op.operationType.toUpperCase() : '';
      const t2 = typeof op?.type === 'string' ? op.type.toUpperCase() : '';
      const t3 = typeof op?.operation?.type === 'string' ? (op.operation.type as string).toUpperCase() : '';
      return t1.includes('FEE') || t2.includes('FEE') || t3.includes('FEE');
    };

    const tryAdd = (candidate: unknown, record: any) => {
      if (!candidate || typeof candidate !== "object") return;
      const op = candidate as Record<string, any>;
      const blockHash = (record.block ?? record.hash ?? record.id ?? (typeof op.block === "string" ? op.block : null)) as string | null;
      if (!blockHash || typeof blockHash !== "string") return;

      const normalizedType = typeof op.type === "string" ? op.type.toUpperCase() : "UNKNOWN";

      const fallbackAmount = sx(op.amount ?? op.rawAmount) ?? sx(record.amount ?? record.rawAmount);
      const fallbackToken = sx(op.token ?? op.tokenAddress) ?? sx(record.token ?? record.tokenAddress);
      const fallbackFrom = sx(op.from) ?? sx(record.from ?? record.account);
      const fallbackTo = sx(op.to ?? op.toAccount) ?? sx(record.to);
      const fallbackFormatted = sx(op.formattedAmount) ?? sx(record.formattedAmount);
      let fallbackTicker = sx(op.tokenTicker) ?? sx(record.tokenTicker);
      const fallbackDecimals = typeof (op.tokenDecimals ?? record.tokenDecimals) === "number" ? Number(op.tokenDecimals ?? record.tokenDecimals) : undefined;
      const fallbackMetadata = (op.tokenMetadata ?? record.tokenMetadata ?? record.metadata) ?? undefined;

      const block = {
        $hash: blockHash,
        date: resolveDate(op.date, record.date, record.createdAt, record.timestamp),
        account: sx(op.account ?? record.account ?? record.from),
      };

      const operationPayload: Record<string, any> = {
        type: normalizedType,
        voteStapleHash: sx(record.voteStaple?.hash) ?? blockHash,
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
        operationType: (typeof op.operationType === "string" ? op.operationType : typeof op.operationType === "number" ? String(op.operationType) : undefined) ?? record.operationType ?? op.type,
      };

      // Fallback for base token (KTA): some records omit token fields for the base token
      if (!operationPayload.token && !operationPayload.tokenAddress && !operationPayload.tokenTicker) {
        operationPayload.tokenTicker = 'KTA';
      }

      // Decode base64 token metadata if present and enrich fields
      if (typeof fallbackMetadata === 'string') {
        const parsedMeta = parseTokenMetadata(fallbackMetadata);
        if (parsedMeta) {
          // Normalize a minimal metadata object for downstream UI
          const normalizedMeta: any = {
            name: parsedMeta.name,
            ticker: parsedMeta.ticker,
            decimals: typeof parsedMeta.decimals === 'number' ? parsedMeta.decimals : undefined,
          };
          operationPayload.tokenMetadata = normalizedMeta;
          if (!operationPayload.tokenTicker && parsedMeta.ticker) {
            operationPayload.tokenTicker = parsedMeta.ticker;
          }
          if (!operationPayload.tokenDecimals && typeof parsedMeta.decimals === 'number') {
            operationPayload.tokenDecimals = parsedMeta.decimals;
          }
          // Compute formatted amount if missing and we have decimals
          const amountStr = (operationPayload.rawAmount ?? operationPayload.amount) as string | undefined;
          if (!operationPayload.formattedAmount && amountStr && operationPayload.tokenDecimals !== undefined) {
            try {
              const amt = BigInt(amountStr);
              const ticker = operationPayload.tokenTicker || 'UNKNOWN';
              operationPayload.formattedAmount = formatTokenAmount(amt, operationPayload.tokenDecimals, parsedMeta.fieldType === 'decimalPlaces' ? 'decimalPlaces' : 'decimals', ticker);
            } catch {}
          }
        }
      }

      // If still missing formatted amount but ticker is KTA, format using 8 decimals as a reasonable default
      if (!operationPayload.formattedAmount && operationPayload.tokenTicker === 'KTA') {
        const amountStr = (operationPayload.rawAmount ?? operationPayload.amount) as string | undefined;
        if (amountStr) {
          try {
            const amt = BigInt(amountStr);
            operationPayload.formattedAmount = formatTokenAmount(amt, 8, 'decimals', 'KTA');
          } catch {}
        }
      }

      // Lazy import to avoid re-implementing parser
      const { parseExplorerOperation } = require("@/lib/explorer/client") as { parseExplorerOperation: (x: any) => ExplorerOperation | null };
      const parsed = parseExplorerOperation(operationPayload);
      if (parsed) {
        if (isFeeLike({ ...parsed, operation: parsed.operation })) {
          return; // Skip network/operation fee entries
        }
        // Classify relative to user's account for better UX
        const ctx = typeof publicKey === 'string' ? publicKey : '';
        let finalType = parsed.type;
        if (ctx) {
          const pFrom = (parsed.from as string | undefined) ?? ((parsed.operation as any)?.from as string | undefined);
          const pTo = (parsed.to as string | undefined) ?? ((parsed.operation as any)?.to as string | undefined);
          if (pFrom && pFrom === ctx && (!pTo || pTo !== ctx)) {
            finalType = 'SEND';
          } else if (pTo && pTo === ctx && (!pFrom || pFrom !== ctx)) {
            finalType = 'RECEIVE';
          }
        }
        const kFrom = (parsed.from as string | undefined) ?? ((parsed.operation as any)?.from as string | undefined) ?? '';
        const kTo = (parsed.to as string | undefined) ?? ((parsed.operation as any)?.to as string | undefined) ?? '';
        const kToken = (parsed.token as string | undefined) ?? ((parsed.operation as any)?.token as string | undefined) ?? '';
        const kAmount = (typeof parsed.rawAmount === 'string' ? parsed.rawAmount : (typeof parsed.amount === 'string' ? parsed.amount : '')) ?? '';
        const key = `${blockHash}|${kFrom}|${kTo}|${kToken}|${kAmount}`;
        if (seen.has(key) || seenKeysRef.current.has(key)) return;
        seen.add(key);
        seenKeysRef.current.add(key);
        collected.push({ ...parsed, type: finalType });
      }
    };

    for (const record of records) {
      const inline = Array.isArray(record.operations) ? record.operations : [];
      const voteStapleOps = Array.isArray(record.voteStaple?.operations) ? record.voteStaple.operations : [];
      const blockOps = record.voteStaple?.blocks?.flatMap((b: any) => (Array.isArray(b?.operations) ? b.operations : [])) ?? [];
      inline.forEach((c: unknown) => tryAdd(c, record));
      voteStapleOps.forEach((c: unknown) => tryAdd(c, record));
      blockOps.forEach((c: unknown) => tryAdd(c, record));
      if (inline.length === 0 && voteStapleOps.length === 0 && blockOps.length === 0) {
        tryAdd(record, record);
      }
    }

    if (collected.length === 0) {
      return 0;
    }

    setOperations((prev) => [...prev, ...collected]);

    // Schedule token metadata fetches for new tokens lacking metadata
    const toFetch = new Set<string>();
    for (const item of collected) {
      const tokenId = (item.token || item.tokenAddress || (item.operation as any)?.token) as string | undefined;
      if (!tokenId) continue;
      // Skip base token KTA by ticker hint if present
      const ticker = (item.tokenTicker || (item.tokenMetadata as any)?.ticker) as string | undefined;
      if (ticker && ticker.toUpperCase() === 'KTA') continue;
      toFetch.add(tokenId);
    }
    for (const id of toFetch) void fetchAndApplyTokenMetadata(id);

    return collected.length;
  }, [fetchAndApplyTokenMetadata, publicKey]);

  // Pure collection helper for React Query pages
  const collectFromRecords = React.useCallback((records: any[]): { ops: ExplorerOperation[]; tokensToFetch: Set<string> } => {
    const ops: ExplorerOperation[] = [];
    const tokensToFetch = new Set<string>();

    const isFeeLike = (op: any): boolean => {
      const t1 = typeof op?.operationType === 'string' ? op.operationType.toUpperCase() : '';
      const t2 = typeof op?.type === 'string' ? op.type.toUpperCase() : '';
      const t3 = typeof op?.operation?.type === 'string' ? (op.operation.type as string).toUpperCase() : '';
      return t1.includes('FEE') || t2.includes('FEE') || t3.includes('FEE');
    };

    const tryAdd = (candidate: unknown, record: any) => {
      if (!candidate || typeof candidate !== "object") return;
      const op = candidate as Record<string, any>;
      const blockHash = (record.block ?? record.hash ?? record.id ?? (typeof op.block === "string" ? op.block : null)) as string | null;
      if (!blockHash || typeof blockHash !== "string") return;

      const normalizedType = typeof op.type === "string" ? op.type.toUpperCase() : "UNKNOWN";

      const fallbackAmount = sx(op.amount ?? op.rawAmount) ?? sx(record.amount ?? record.rawAmount);
      const fallbackToken = sx(op.token ?? op.tokenAddress) ?? sx(record.token ?? record.tokenAddress);
      const fallbackFrom = sx(op.from) ?? sx(record.from ?? record.account);
      const fallbackTo = sx(op.to ?? op.toAccount) ?? sx(record.to);
      const fallbackFormatted = sx(op.formattedAmount) ?? sx(record.formattedAmount);
      let fallbackTicker = sx(op.tokenTicker) ?? sx(record.tokenTicker);
      const fallbackDecimals = typeof (op.tokenDecimals ?? record.tokenDecimals) === "number" ? Number(op.tokenDecimals ?? record.tokenDecimals) : undefined;
      const fallbackMetadata = (op.tokenMetadata ?? record.tokenMetadata ?? record.metadata) ?? undefined;

      const block = {
        $hash: blockHash,
        date: resolveDate(op.date, record.date, record.createdAt, record.timestamp),
        account: sx(op.account ?? record.account ?? record.from),
      };

      const operationPayload: Record<string, any> = {
        type: normalizedType,
        voteStapleHash: sx(record.voteStaple?.hash) ?? blockHash,
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
        operationType: (typeof op.operationType === "string" ? op.operationType : typeof op.operationType === "number" ? String(op.operationType) : undefined) ?? record.operationType ?? op.type,
      };

      if (!operationPayload.token && !operationPayload.tokenAddress && !operationPayload.tokenTicker) {
        operationPayload.tokenTicker = 'KTA';
      }

      if (typeof fallbackMetadata === 'string') {
        const parsedMeta = parseTokenMetadata(fallbackMetadata);
        if (parsedMeta) {
          const normalizedMeta: any = {
            name: parsedMeta.name,
            ticker: parsedMeta.ticker,
            decimals: typeof parsedMeta.decimals === 'number' ? parsedMeta.decimals : undefined,
          };
          operationPayload.tokenMetadata = normalizedMeta;
          if (!operationPayload.tokenTicker && parsedMeta.ticker) {
            operationPayload.tokenTicker = parsedMeta.ticker;
          }
          if (!operationPayload.tokenDecimals && typeof parsedMeta.decimals === 'number') {
            operationPayload.tokenDecimals = parsedMeta.decimals;
          }
          const amountStr = (operationPayload.rawAmount ?? operationPayload.amount) as string | undefined;
          if (!operationPayload.formattedAmount && amountStr && operationPayload.tokenDecimals !== undefined) {
            try {
              const amt = BigInt(amountStr);
              const ticker = operationPayload.tokenTicker || 'UNKNOWN';
              operationPayload.formattedAmount = formatTokenAmount(amt, operationPayload.tokenDecimals, parsedMeta.fieldType === 'decimalPlaces' ? 'decimalPlaces' : 'decimals', ticker);
            } catch {}
          }
        }
      }

      if (!operationPayload.formattedAmount && operationPayload.tokenTicker === 'KTA') {
        const amountStr = (operationPayload.rawAmount ?? operationPayload.amount) as string | undefined;
        if (amountStr) {
          try {
            const amt = BigInt(amountStr);
            operationPayload.formattedAmount = formatTokenAmount(amt, 8, 'decimals', 'KTA');
          } catch {}
        }
      }

      const { parseExplorerOperation } = require("@/lib/explorer/client") as { parseExplorerOperation: (x: any) => ExplorerOperation | null };
      const parsed = parseExplorerOperation(operationPayload);
      if (parsed) {
        if (isFeeLike({ ...parsed, operation: parsed.operation })) {
          return;
        }
        const ctx = typeof publicKey === 'string' ? publicKey : '';
        let finalType = parsed.type;
        if (ctx) {
          const pFrom = (parsed.from as string | undefined) ?? ((parsed.operation as any)?.from as string | undefined);
          const pTo = (parsed.to as string | undefined) ?? ((parsed.operation as any)?.to as string | undefined);
          if (pFrom && pFrom === ctx && (!pTo || pTo !== ctx)) {
            finalType = 'SEND';
          } else if (pTo && pTo === ctx && (!pFrom || pFrom !== ctx)) {
            finalType = 'RECEIVE';
          }
        }
        const kFrom = (parsed.from as string | undefined) ?? ((parsed.operation as any)?.from as string | undefined) ?? '';
        const kTo = (parsed.to as string | undefined) ?? ((parsed.operation as any)?.to as string | undefined) ?? '';
        const kToken = (parsed.token as string | undefined) ?? ((parsed.operation as any)?.token as string | undefined) ?? '';
        const kAmount = (typeof parsed.rawAmount === 'string' ? parsed.rawAmount : (typeof parsed.amount === 'string' ? parsed.amount : '')) ?? '';
        const key = `${blockHash}|${kFrom}|${kTo}|${kToken}|${kAmount}`;
        if (seenKeysRef.current.has(key)) return;
        seenKeysRef.current.add(key);
        ops.push({ ...parsed, type: finalType });
      }
    };

    for (const record of records) {
      const inline = Array.isArray(record.operations) ? record.operations : [];
      const voteStapleOps = Array.isArray(record.voteStaple?.operations) ? record.voteStaple.operations : [];
      const blockOps = record.voteStaple?.blocks?.flatMap((b: any) => (Array.isArray(b?.operations) ? b.operations : [])) ?? [];
      inline.forEach((c: unknown) => tryAdd(c, record));
      voteStapleOps.forEach((c: unknown) => tryAdd(c, record));
      blockOps.forEach((c: unknown) => tryAdd(c, record));
      if (inline.length === 0 && voteStapleOps.length === 0 && blockOps.length === 0) {
        tryAdd(record, record);
      }
    }

    // Schedule token metadata fetches for new tokens lacking metadata
    for (const item of ops) {
      const tokenId = (item.token || item.tokenAddress || (item.operation as any)?.token) as string | undefined;
      if (!tokenId) continue;
      const ticker = (item.tokenTicker || (item.tokenMetadata as any)?.ticker) as string | undefined;
      if (ticker && ticker.toUpperCase() === 'KTA') continue;
      tokensToFetch.add(tokenId);
    }

    return { ops, tokensToFetch };
  }, [publicKey]);

  React.useEffect(() => {
    seenKeysRef.current.clear();
    if (!cacheKey) {
      setOperations([]);
      setCursor(null);
      setHasMore(false);
      setLoading(false);
      pendingInitialFetchRef.current = false;
      return;
    }
    const cached = historyCache.get(cacheKey);
    if (cached) {
      setOperations(cached.operations.map((op) => ({ ...op })));
      seenKeysRef.current = new Set(cached.seenKeys);
      setCursor(cached.cursor);
      setHasMore(cached.hasMore);
      setLoading(false);
      pendingInitialFetchRef.current = false;
    } else {
      setOperations([]);
      seenKeysRef.current = new Set();
      setCursor(null);
      setHasMore(false);
      setLoading(true);
      pendingInitialFetchRef.current = true;
    }
  }, [cacheKey]);

  const load = React.useCallback(async (next: boolean, options: { force?: boolean } = {}): Promise<number> => {
    try {
      setLoading(true);
      setError(null);
      if (typeof window === "undefined" || !window.keeta?.history) {
        setError(FALLBACK_MESSAGE);
        return 0;
      }
      try {
        if (typeof window.keeta.requestCapabilities === "function") {
          await window.keeta.requestCapabilities(["read"]);
        }
      } catch {}

      const resp = await window.keeta.history({
        depth: 50,
        cursor: next ? cursor : null,
        includeOperations: true,
        includeTokenMetadata: true,
      } as any);

      let records: any[] = Array.isArray(resp?.records) ? resp.records : [];

      // Try to use SDK's staple filter to avoid duplicates and pull only account-relevant ops
      try {
        const uc: any = await window.keeta.getUserClient?.();
        const hasFilter = uc && (typeof uc.filterStapleOperations === 'function' || typeof uc.filterStapleOps === 'function');
        const account = typeof publicKey === 'string' ? publicKey : undefined;
        if (hasFilter && account) {
          for (const rec of records) {
            const staple = (rec && typeof rec === 'object') ? (rec as any).voteStaple : null;
            if (!staple) continue;
            try {
              let filtered: any;
              if (typeof uc.filterStapleOperations === 'function') {
                filtered = await uc.filterStapleOperations(staple, { account });
              } else if (typeof uc.filterStapleOps === 'function') {
                filtered = await uc.filterStapleOps(staple, { account });
              }
              if (Array.isArray(filtered)) {
                rec.operations = filtered;
              } else if (filtered && Array.isArray(filtered.operations)) {
                rec.operations = filtered.operations;
              }
            } catch {}
          }
        }
      } catch {}

      const appended = appendFromRecords(records);
      setCursor(typeof resp?.cursor === "string" ? resp.cursor : null);
      setHasMore(Boolean(resp?.hasMore));
      return appended;
    } catch (e) {
      setError(FALLBACK_MESSAGE);
      return 0;
    } finally {
      setLoading(false);
    }
  }, [appendFromRecords, cursor, publicKey]);

  React.useEffect(() => {
    if (!cacheKey) return;
    if (pendingInitialFetchRef.current) {
      pendingInitialFetchRef.current = false;
    }
  }, [cacheKey]);

  // React Query: history pages with no TTL
  const accountKey = typeof publicKey === 'string' ? publicKey : '';
  const historyQuery = useInfiniteQuery({
    queryKey: ['history', accountKey],
    queryFn: async ({ pageParam }) => {
      if (typeof window === 'undefined' || !window.keeta?.history) {
        return { records: [], cursor: null, hasMore: false } as { records: any[]; cursor: string | null; hasMore: boolean };
      }
      try {
        if (typeof window.keeta.requestCapabilities === 'function') {
          await window.keeta.requestCapabilities(['read']);
        }
      } catch {}
      const resp = await window.keeta.history({
        depth: 50,
        cursor: pageParam ?? null,
        includeOperations: true,
        includeTokenMetadata: true,
      } as any);
      let records: any[] = Array.isArray(resp?.records) ? resp.records : [];
      // Apply SDK staple filtering per record when available
      try {
        const uc: any = await window.keeta.getUserClient?.();
        const hasFilter = uc && (typeof uc.filterStapleOperations === 'function' || typeof uc.filterStapleOps === 'function');
        const account = typeof publicKey === 'string' ? publicKey : undefined;
        if (hasFilter && account) {
          for (const rec of records) {
            const staple = (rec && typeof rec === 'object') ? (rec as any).voteStaple : null;
            if (!staple) continue;
            try {
              let filtered: any;
              if (typeof uc.filterStapleOperations === 'function') {
                filtered = await uc.filterStapleOperations(staple, { account });
              } else if (typeof uc.filterStapleOps === 'function') {
                filtered = await uc.filterStapleOps(staple, { account });
              }
              if (Array.isArray(filtered)) {
                rec.operations = filtered;
              } else if (filtered && Array.isArray(filtered.operations)) {
                rec.operations = filtered.operations;
              }
            } catch {}
          }
        }
      } catch {}
      return {
        records,
        cursor: typeof resp?.cursor === 'string' ? resp.cursor : null,
        hasMore: Boolean(resp?.hasMore),
      } as { records: any[]; cursor: string | null; hasMore: boolean };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.cursor : undefined,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: accountKey.length > 0,
  });

  // Build operations from query data
  React.useEffect(() => {
    const pages = historyQuery.data?.pages;
    // Do not touch operations until the query has produced any page data
    if (!pages) {
      return;
    }
    const allRecords: any[] = [];
    for (const p of pages) {
      if (Array.isArray(p?.records)) allRecords.push(...p.records);
    }
    if (allRecords.length === 0) {
      setOperations([]);
      return;
    }
    const { ops, tokensToFetch } = collectFromRecords(allRecords);
    setOperations(ops);
    for (const id of tokensToFetch) void fetchAndApplyTokenMetadata(id);
  }, [historyQuery.data, collectFromRecords, fetchAndApplyTokenMetadata]);

  // Fallback: derive operations directly from persisted query on first render to avoid flicker
  const derivedOpsFromQuery = React.useMemo<ExplorerOperation[]>(() => {
    const pages = historyQuery.data?.pages;
    if (!pages) return [];
    const allRecords: any[] = [];
    for (const p of pages) {
      if (Array.isArray(p?.records)) allRecords.push(...p.records);
    }
    if (allRecords.length === 0) return [];
    const { ops } = collectFromRecords(allRecords);
    return ops;
  }, [historyQuery.data, collectFromRecords]);
  // Persist local cache snapshot for this account
  React.useEffect(() => {
    if (!cacheKey) return;
    historyCache.set(cacheKey, {
      operations: operations.map((op) => ({ ...op })),
      cursor,
      hasMore,
      seenKeys: Array.from(seenKeysRef.current),
    });
  }, [operations, cursor, hasMore, cacheKey]);

  // Choose ops from state or derived query as fallback
  const baseOperations = operations.length > 0 ? operations : derivedOpsFromQuery;

  // Group by block and aggregate amounts by token
  const groupedOperations = React.useMemo(() => {
    const byHash = new Map<string, ExplorerOperation[]>();
    const orphans: ExplorerOperation[] = [];

    for (const op of baseOperations) {
      const hash = (op.block && typeof op.block.$hash === 'string') ? op.block.$hash : (op as any)?.hash;
      if (typeof hash === 'string' && hash.length > 0) {
        const list = byHash.get(hash) ?? [];
        list.push(op);
        byHash.set(hash, list);
      } else {
        orphans.push(op);
      }
    }

    const result: ExplorerOperation[] = [];

    const toBigInt = (v: unknown): bigint => {
      if (typeof v === 'bigint') return v;
      if (typeof v === 'string' && v.trim().length > 0) {
        try { return BigInt(v.trim()); } catch { return BigInt(0); }
      }
      if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v));
      return BigInt(0);
    };

    for (const [, ops] of byHash.entries()) {
      if (ops.length <= 1) {
        result.push(ops[0]);
        continue;
      }

      // Aggregate by token key
      const sums = new Map<string, { sum: bigint; decimals: number; ticker: string }>();
      let net: bigint = BigInt(0);
      let firstSend: ExplorerOperation | null = null;
      let firstReceive: ExplorerOperation | null = null;

      for (const op of ops) {
        const t = (op.type || '').toUpperCase();
        const sign = t === 'SEND' ? BigInt(-1) : t === 'RECEIVE' ? BigInt(1) : BigInt(0);
        const raw = toBigInt((op as any).rawAmount ?? (op as any).amount ?? ((op as any).operation as any)?.amount);
        const amt = raw * sign;
        net += amt;

        const tokenKey = (op as any).token || (op as any).tokenAddress || ((op as any).operation as any)?.token || (op as any).tokenTicker || 'KTA';
        const decimals = typeof (op as any).tokenDecimals === 'number' ? (op as any).tokenDecimals : (typeof ((op as any).tokenMetadata as any)?.decimals === 'number' ? ((op as any).tokenMetadata as any).decimals : 8);
        const ticker = (op as any).tokenTicker || ((op as any).tokenMetadata as any)?.ticker || 'KTA';

        const entry = sums.get(tokenKey) ?? { sum: BigInt(0), decimals, ticker };
        entry.sum += amt;
        if (!entry.decimals && decimals) entry.decimals = decimals;
        if (!entry.ticker && ticker) entry.ticker = ticker;
        sums.set(tokenKey, entry);

        if (sign < BigInt(0) && !firstSend) firstSend = op;
        if (sign > BigInt(0) && !firstReceive) firstReceive = op;
      }

      // Build formatted combined amount string
      const parts: string[] = [];
      for (const [, info] of sums) {
        if (info.sum === BigInt(0)) continue;
        const abs = info.sum < BigInt(0) ? -info.sum : info.sum;
        try {
          parts.push(formatTokenAmount(abs, info.decimals || 8, 'decimals', info.ticker || 'UNKNOWN'));
        } catch {
          parts.push(`${abs.toString()} ${info.ticker || ''}`.trim());
        }
      }
      const combined = parts.join(' + ');

      const base = ops[0] as any;
      const synthetic: any = { ...base };
      synthetic.type = net < BigInt(0) ? 'SEND' : net > BigInt(0) ? 'RECEIVE' : (base.type || 'Transaction');
      synthetic.formattedAmount = combined || base.formattedAmount || base.amount || base.rawAmount || '';
      // Prefer participants from directionally appropriate op
      const pick = net < BigInt(0) ? firstSend : net > BigInt(0) ? firstReceive : ops[0];
      const fromPick = (pick as any)?.from ?? ((pick as any)?.operation as any)?.from;
      const toPick = (pick as any)?.to ?? ((pick as any)?.operation as any)?.to;
      synthetic.from = fromPick;
      synthetic.to = toPick;
      synthetic.operation = { ...(base.operation || {}), from: fromPick, to: toPick };
      if (sums.size > 1) {
        synthetic.tokenMetadata = { name: 'Multiple tokens' };
        delete synthetic.tokenTicker;
      } else {
        // Keep first token ticker if available
        const single = Array.from(sums.values())[0];
        synthetic.tokenTicker = single?.ticker || synthetic.tokenTicker;
        synthetic.tokenDecimals = typeof single?.decimals === 'number' ? single.decimals : synthetic.tokenDecimals;
      }
      result.push(synthetic as ExplorerOperation);
    }

    return [...orphans, ...result].sort((a, b) => {
      const ta = (a as any)?.block?.date ? new Date((a as any).block.date as string).getTime() : 0;
      const tb = (b as any)?.block?.date ? new Date((b as any).block.date as string).getTime() : 0;
      return tb - ta;
    });
  }, [baseOperations]);

  React.useEffect(() => {
    const maxPage = Math.max(Math.ceil(groupedOperations.length / PAGE_SIZE) - 1, 0);
    if (pageIndex > maxPage) {
      setPageIndex(maxPage);
    }
  }, [groupedOperations.length, pageIndex, PAGE_SIZE]);

  const displayedOperations = React.useMemo(
    () => groupedOperations.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE),
    [groupedOperations, pageIndex, PAGE_SIZE],
  );

  const totalKnownPages = Math.max(Math.ceil(groupedOperations.length / PAGE_SIZE), 1);
  const hasMoreFromQuery = Boolean((historyQuery as any)?.hasNextPage);
  const pageLabel = hasMoreFromQuery ? `${totalKnownPages}+` : `${totalKnownPages}`;
  const canGoPrev = pageIndex > 0;
  const canGoNext = groupedOperations.length > (pageIndex + 1) * PAGE_SIZE || hasMoreFromQuery;
  const hasCachedRecords = React.useMemo(() => {
    const pages = historyQuery.data?.pages ?? [];
    for (const p of pages) {
      if (Array.isArray(p?.records) && p.records.length > 0) return true;
    }
    return false;
  }, [historyQuery.data]);
  const isWaitingForAccount = isClient && accountKey.length === 0;
  const showSkeleton = Boolean(!isClient || isWaitingForAccount || (historyQuery.isLoading && !hasCachedRecords));
  const tableLoading = Boolean(
    showSkeleton ||
    (
      groupedOperations.length === 0 &&
      (!historyQuery.isSuccess || historyQuery.isFetching)
    )
  );

  const handlePrev = React.useCallback(() => {
    setPageIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleNext = React.useCallback(async () => {
    const nextPage = pageIndex + 1;
    const nextPageStart = nextPage * PAGE_SIZE;
    if (groupedOperations.length > nextPageStart) {
      setPageIndex(nextPage);
      return;
    }

    if (!hasMoreFromQuery) {
      return;
    }

    await historyQuery.fetchNextPage();
    setPageIndex(nextPage);
  }, [pageIndex, PAGE_SIZE, groupedOperations.length, hasMoreFromQuery, historyQuery]);

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
                {error ? (
                  <div className="flex h-full items-center justify-center rounded-xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-8 text-sm text-muted">
                    {error}
                  </div>
                ) : (
                  <div className={`flex ${displayedOperations.length <= PAGE_SIZE ? 'justify-center' : 'justify-start'} flex-col gap-4 flex-1`}>
                    <div className="shrink-0">
                      <ExplorerOperationsTable operations={displayedOperations} participantsMode="smart" loading={tableLoading} emptyLabel={'No history found.'} />
                    </div>
                    <div className={`shrink-0 flex items-center px-1 transition-opacity ${showSkeleton ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                      <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
                        &nbsp;
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 min-w-[2.5rem] px-2"
                            onClick={() => setPageIndex(0)}
                            disabled={!canGoPrev}
                            aria-label="Go to first page"
                          >
                            {"<<"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 min-w-[2.5rem] px-2"
                            onClick={handlePrev}
                            disabled={!canGoPrev}
                            aria-label="Go to previous page"
                          >
                            {"<"}
                          </Button>
                          <span className="px-1 text-sm font-medium">
                            Page {pageIndex + 1} of {pageLabel}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 min-w-[2.5rem] px-2"
                            onClick={handleNext}
                            disabled={!canGoNext}
                            aria-label="Go to next page"
                          >
                            {">"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 min-w-[2.5rem] px-2"
                            onClick={() => {
                              if (!hasMore) {
                                const last = Math.max(Math.ceil(groupedOperations.length / PAGE_SIZE) - 1, 0);
                                setPageIndex(last);
                              }
                            }}
                            disabled={hasMore || !canGoNext}
                            aria-label="Go to last page"
                          >
                            {">>"}
                          </Button>
                      </div>
                    </div>
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
