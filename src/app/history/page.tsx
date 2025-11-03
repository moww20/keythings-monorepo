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

  const historyQuery = useInfiniteQuery<
    ProviderHistoryPage,
    Error,
    InfiniteData<ProviderHistoryPage, string | null>,
    ["history", string],
    string | null
  >({
    queryKey: ["history", accountKey],
    initialPageParam: null as string | null,
    enabled:
      isClient &&
      accountKey.length > 0 &&
      hasHistoryCapability &&
      !capabilityLoading,
    queryFn: async ({ pageParam }) => {
      const provider = typeof window !== "undefined" ? window.keeta : undefined;
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

  const groupedOperations = useMemo(
    () => groupOperationsByBlock(normalized.operations),
    [normalized.operations],
  );

  const awaitingWallet =
    isClient && (!wallet.connected || wallet.isLocked || accountKey.length === 0);
  const missingCapability =
    isClient &&
    wallet.connected &&
    !wallet.isLocked &&
    accountKey.length > 0 &&
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
