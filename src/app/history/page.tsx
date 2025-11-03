"use client";

import type { CSSProperties, JSX } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { z } from "zod";

import ExplorerOperationsTable from "@/app/explorer/components/ExplorerOperationsTable";
import { parseTokenMetadata } from "@/app/explorer/utils/token-metadata";
import { useWallet } from "@/app/contexts/WalletContext";
import { useCapabilityRequest } from "@/app/hooks/useCapabilityRequest";
import { AppSidebar } from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  fetchProviderHistory,
  groupOperationsByBlock,
  normalizeHistoryRecords,
  type CachedTokenMeta,
  type ProviderHistoryPage,
} from "@/lib/history/provider-history";
import { getBlock } from "@/lib/explorer/sdk-read-client";
import { getTokenMeta } from "@/lib/tokens/metadata-service";

const HISTORY_DEPTH = 50;
const FALLBACK_MESSAGE = "Connect your Keeta wallet to pull on-chain activity.";
const GRANT_HISTORY_MESSAGE = "Grant history access in the Keeta wallet to view activity.";

const TokenMetadataSchema = z
  .object({
    name: z.string().optional(),
    ticker: z.string().optional(),
    symbol: z.string().optional(),
    decimals: z.number().optional(),
    metadata: z.string().optional(),
    metadataBase64: z.string().optional(),
  })
  .passthrough();

export default function HistoryPage(): JSX.Element {
  const { publicKey, wallet } = useWallet();
  const [isClient, setIsClient] = useState(false);
  const [tokenMetadata, setTokenMetadata] = useState<Record<string, CachedTokenMeta>>({});
  const [blockTimestamps, setBlockTimestamps] = useState<Map<string, string>>(() => new Map());
  const fetchingTokenMeta = useRef<Set<string>>(new Set());

  useEffect(() => {
    setIsClient(true);
  }, []);

  const accountKey = useMemo(() => (typeof publicKey === "string" ? publicKey : ""), [publicKey]);

  useEffect(() => {
    setTokenMetadata({});
    fetchingTokenMeta.current.clear();
  }, [accountKey]);

  const capabilityProvider = useMemo(() => {
    if (!isClient || !wallet.connected || wallet.isLocked) {
      return null;
    }

    if (typeof window === "undefined") {
      return null;
    }

    const keeta = window.keeta;
    if (!keeta || typeof keeta.history !== "function") {
      return null;
    }

    const refresh =
      typeof keeta === "object" && keeta !== null && "refreshCapabilities" in keeta &&
      typeof (keeta as { refreshCapabilities: unknown }).refreshCapabilities === "function"
        ? (keeta as { refreshCapabilities: (caps: string[]) => Promise<unknown> }).refreshCapabilities.bind(keeta)
        : undefined;
    const request =
      typeof keeta.requestCapabilities === "function"
        ? keeta.requestCapabilities.bind(keeta)
        : undefined;

    if (!refresh && !request) {
      return null;
    }

    return {
      refreshCapabilities: refresh,
      requestCapabilities: request,
    };
  }, [isClient, wallet.connected, wallet.isLocked]);

  const {
    granted: hasHistoryCapability,
    loading: capabilityLoading,
    error: capabilityError,
    request: requestHistoryCapability,
    reset: resetHistoryCapability,
  } = useCapabilityRequest({
    capability: "history",
    provider: capabilityProvider ?? undefined,
    autoRequest: Boolean(capabilityProvider),
  });

  useEffect(() => {
    if (!capabilityProvider) {
      resetHistoryCapability();
    }
  }, [capabilityProvider, resetHistoryCapability]);

  const canCallHistory = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean((window as any).keeta && typeof (window as any).keeta.history === "function");
  }, [isClient]);

  useEffect(() => {
    try {
      console.debug("[HistoryPage] gating", {
        isClient,
        walletConnected: wallet.connected,
        walletLocked: wallet.isLocked,
        accountKey,
        canCallHistory,
        hasHistoryCapability,
        capabilityLoading,
        capabilityError,
        hasProviderMethods: Boolean(capabilityProvider),
      });
    } catch {}
  }, [isClient, wallet.connected, wallet.isLocked, accountKey, canCallHistory, hasHistoryCapability, capabilityLoading, capabilityError, capabilityProvider]);

  const enableHistoryQuery =
    isClient &&
    accountKey.length > 0 &&
    canCallHistory &&
    (
      !capabilityProvider
        ? true
        : (hasHistoryCapability && !capabilityLoading)
    );

  const historyQuery = useInfiniteQuery<
    ProviderHistoryPage,
    Error,
    InfiniteData<ProviderHistoryPage, string | null>,
    ["history", string],
    string | null
  >({
    queryKey: ["history", accountKey],
    initialPageParam: null as string | null,
    enabled: enableHistoryQuery,
    queryFn: async ({ pageParam }) => {
      const provider = typeof window !== "undefined" ? window.keeta : undefined;
      try { console.debug("[HistoryPage] queryFn", { pageParam, hasProvider: Boolean(provider), enableHistoryQuery }); } catch {}
      return fetchProviderHistory(provider, {
        depth: HISTORY_DEPTH,
        cursor: typeof pageParam === "string" && pageParam.length > 0 ? pageParam : undefined,
      });
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data, fetchNextPage, hasNextPage = false, isFetchingNextPage, isLoading, isError } = historyQuery;

  const pages = useMemo(() => data?.pages ?? [], [data]);

  const allRecords = useMemo(
    () =>
      pages.flatMap((page: ProviderHistoryPage) =>
        Array.isArray(page?.records) ? page.records : [],
      ),
    [pages],
  );

  const normalized = useMemo(
    () => normalizeHistoryRecords(allRecords, accountKey, tokenMetadata),
    [allRecords, accountKey, tokenMetadata],
  );

  useEffect(() => {
    try {
      const pagesCount = Array.isArray(pages) ? pages.length : 0;
      const sampleRecords = pagesCount > 0 && Array.isArray((pages[0] as any)?.records)
        ? (pages[0] as any).records
        : [];
      const sampleKeys = sampleRecords.length > 0 && sampleRecords[0]
        ? Object.keys(sampleRecords[0]).slice(0, 8)
        : [];
      const sampleRecordPreview = sampleRecords.length > 0 && sampleRecords[0]
        ? Object.fromEntries(Object.entries(sampleRecords[0]).slice(0, 6))
        : null;
      console.debug("[HistoryPage] data pages", {
        pagesCount,
        firstPageRecords: sampleRecords.length,
        sampleKeys,
        sampleRecordPreview,
      });
      if (typeof window !== "undefined") {
        (window as any).__HISTORY_DEBUG_PAGES__ = pages;
        (window as any).__HISTORY_DEBUG_NORMALIZED__ = normalized;
      }
    } catch {}
  }, [pages, normalized]);

  useEffect(() => {
    try {
      console.debug("[HistoryPage] normalized", {
        records: allRecords.length,
        operations: normalized.operations.length,
        tokensToFetch: normalized.tokensToFetch.length,
        blocksToFetch: normalized.blocksToFetch.length,
      });
    } catch {}
  }, [allRecords.length, normalized.operations.length, normalized.tokensToFetch.length, normalized.blocksToFetch.length]);

  useEffect(() => {
    if (!normalized.tokensToFetch.length) {
      return;
    }

    for (const tokenId of normalized.tokensToFetch) {
      if (!tokenId) continue;
      if (tokenMetadata[tokenId]) continue;
      if (fetchingTokenMeta.current.has(tokenId)) continue;

      fetchingTokenMeta.current.add(tokenId);

      void (async () => {
        try {
          const rawMeta = await getTokenMeta(tokenId);
          const parsed = TokenMetadataSchema.safeParse(rawMeta);
          if (!parsed.success) {
            return;
          }

          const normalizedMeta: CachedTokenMeta = {
            name: typeof parsed.data.name === "string" ? parsed.data.name : undefined,
            ticker:
              typeof parsed.data.ticker === "string"
                ? parsed.data.ticker
                : typeof parsed.data.symbol === "string"
                  ? parsed.data.symbol
                  : undefined,
            decimals: typeof parsed.data.decimals === "number" ? parsed.data.decimals : undefined,
            metadataBase64:
              typeof parsed.data.metadataBase64 === "string"
                ? parsed.data.metadataBase64
                : typeof parsed.data.metadata === "string"
                  ? parsed.data.metadata
                  : undefined,
          };

          if (normalizedMeta.metadataBase64) {
            const decoded = parseTokenMetadata(normalizedMeta.metadataBase64);
            if (decoded?.fieldType === "decimalPlaces" || decoded?.fieldType === "decimals") {
              normalizedMeta.fieldType = decoded.fieldType;
            }
            if (typeof decoded?.decimals === "number" && normalizedMeta.decimals === undefined) {
              normalizedMeta.decimals = decoded.decimals;
            }
            if (!normalizedMeta.ticker && typeof decoded?.ticker === "string") {
              normalizedMeta.ticker = decoded.ticker;
            }
            if (!normalizedMeta.name && typeof decoded?.name === "string") {
              normalizedMeta.name = decoded.name;
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
        } catch {
          // ignore token metadata failures
        } finally {
          fetchingTokenMeta.current.delete(tokenId);
        }
      })();
    }
  }, [normalized.tokensToFetch, tokenMetadata]);

  useEffect(() => {
    const pending = normalized.blocksToFetch.filter((hash) => hash && !blockTimestamps.has(hash));
    if (pending.length === 0) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const updates = new Map<string, string>();

      for (const hash of pending) {
        if (!hash) continue;
        try {
          const blockData = await getBlock(hash);
          const timestampCandidate =
            (blockData as any)?.timestamp ??
            (blockData as any)?.createdAt ??
            (blockData as any)?.date ??
            (blockData as any)?.block?.timestamp ??
            (blockData as any)?.block?.createdAt;
          if (timestampCandidate) {
            const parsed = new Date(timestampCandidate);
            if (!Number.isNaN(parsed.getTime())) {
              updates.set(hash, parsed.toISOString());
            }
          }
        } catch (error) {
          console.debug("[HistoryPage] failed to fetch block timestamp", { hash, error });
        }
      }

      if (cancelled || updates.size === 0) {
        return;
      }

      setBlockTimestamps((prev) => {
        const next = new Map(prev);
        for (const [hash, iso] of updates.entries()) {
          if (!next.has(hash)) {
            next.set(hash, iso);
          }
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [normalized.blocksToFetch, blockTimestamps]);

  const hydratedOperations = useMemo(() => {
    if (!blockTimestamps.size) {
      return normalized.operations;
    }

    return normalized.operations.map((operation) => {
      if (operation.block?.date) {
        return operation;
      }

      const blockHash = operation.block?.$hash;
      if (!blockHash) {
        return operation;
      }

      const replacementDate = blockTimestamps.get(blockHash);
      if (!replacementDate) {
        return operation;
      }

      return {
        ...operation,
        block: {
          ...(operation.block ?? {}),
          date: replacementDate,
        },
      };
    });
  }, [normalized.operations, blockTimestamps]);

  const groupedOperations = useMemo(() => groupOperationsByBlock(hydratedOperations), [hydratedOperations]);

  useEffect(() => {
    try {
      console.debug("[HistoryPage] groupedOperations", { grouped: groupedOperations.length });
    } catch {}
  }, [groupedOperations.length]);

  const awaitingWallet =
    isClient && (!wallet.connected || wallet.isLocked || accountKey.length === 0);
  const missingCapability =
    isClient &&
    wallet.connected &&
    !wallet.isLocked &&
    accountKey.length > 0 &&
    Boolean(capabilityProvider) &&
    !hasHistoryCapability &&
    !capabilityLoading;

  const handleCapabilityRequest = useCallback(async () => {
    await requestHistoryCapability();
  }, [requestHistoryCapability]);

  const tableLoading =
    !awaitingWallet && hasHistoryCapability && (isLoading || capabilityLoading) && groupedOperations.length === 0;

  const statusContent = (() => {
    if (awaitingWallet) {
      return <p className="max-w-md text-center text-sm text-muted">{FALLBACK_MESSAGE}</p>;
    }
    if (missingCapability) {
      return (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="max-w-md text-sm text-muted">
            {capabilityError ?? GRANT_HISTORY_MESSAGE}
          </p>
          <Button size="sm" onClick={handleCapabilityRequest} disabled={capabilityLoading}>
            {capabilityLoading ? "Requesting…" : "Grant history access"}
          </Button>
        </div>
      );
    }
    if (isError) {
      return <p className="max-w-md text-center text-sm text-muted">Unable to load history right now.</p>;
    }
    return null;
  })();

  const handleLoadMore = useCallback(async () => {
    if (!hasNextPage) return;
    await fetchNextPage();
  }, [fetchNextPage, hasNextPage]);

  const layoutStyle = {
    "--sidebar-width": "calc(var(--spacing) * 72)",
    "--header-height": "calc(var(--spacing) * 12)",
  } as CSSProperties;

  return (
    <div className="h-screen bg-background">
      <SidebarProvider style={layoutStyle}>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <div className="flex h-full flex-col overflow-hidden">
            <div className="@container/main flex h-full flex-col gap-4 overflow-hidden px-4 py-4 lg:px-6 lg:py-6">
              <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-foreground">History</h1>
                <Badge variant="outline" className="text-xs text-muted">
                  On-chain
                </Badge>
              </header>

              <div className="flex flex-1 flex-col overflow-hidden">
                {statusContent ? (
                  <div className="flex h-full items-center justify-center rounded-xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-8 text-sm text-muted">
                    {statusContent}
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
                      <div className="flex shrink-0 justify-center pb-2">
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
