"use client";

import type { CSSProperties, JSX } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { z } from "zod";

import ExplorerOperationsTable from "@/app/explorer/components/ExplorerOperationsTable";
import { useWallet } from "@/app/contexts/WalletContext";
import { useCapabilityRequest } from "@/app/hooks/useCapabilityRequest";
import { AppSidebar } from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  fetchProviderHistory,
  normalizeHistoryRecords,
  type CachedTokenMeta,
  type ProviderHistoryPage,
} from "@/lib/history/provider-history";
import { getBlock } from "@/lib/explorer/sdk-read-client";
import {
  getTokenMetadata,
  getCachedTokenMetadata,
  type TokenMetadataEntry,
} from "@/lib/tokens/metadata-service";
import { parseExplorerDate } from "@/app/explorer/utils/operation-format";

const HISTORY_DEPTH = 50;
const FALLBACK_MESSAGE = "Connect your Keeta wallet to pull on-chain activity.";
const GRANT_HISTORY_MESSAGE = "Grant history access in the Keeta wallet to view activity.";

const TokenMetadataSchema = z // retained for backward compatibility in case of legacy usage
  .object({
    name: z.string().optional(),
    ticker: z.string().optional(),
    symbol: z.string().optional(),
    decimals: z.number().optional(),
    metadata: z.string().optional(),
    metadataBase64: z.string().optional(),
  })
  .passthrough();

function toCachedTokenMeta(entry: TokenMetadataEntry): CachedTokenMeta {
  return {
    name: entry.name ?? undefined,
    ticker: entry.ticker ?? undefined,
    decimals: typeof entry.decimals === "number" ? entry.decimals : undefined,
    fieldType: entry.fieldType,
    metadataBase64: entry.metadataBase64 ?? undefined,
  } satisfies CachedTokenMeta;
}

export default function HistoryPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { publicKey, wallet } = useWallet();

  const [isClient, setIsClient] = useState(false);
  const [tokenMetadata, setTokenMetadata] = useState<Record<string, CachedTokenMeta>>({});
  const [blockTimestamps, setBlockTimestamps] = useState<Map<string, string>>(() => new Map());
  const fetchingTokenMeta = useRef<Set<string>>(new Set());
  const fetchingBlocks = useRef<Set<string>>(new Set());
  const blockAttempts = useRef<Map<string, number>>(new Map());
  const [retryTick, setRetryTick] = useState(0);
  const [gateActive, setGateActive] = useState(true);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const accountKey = useMemo(() => (typeof publicKey === "string" ? publicKey : ""), [publicKey]);

  useEffect(() => {
    setTokenMetadata({});
    fetchingTokenMeta.current.clear();
  }, [accountKey]);

  useEffect(() => {
    if (!isClient) return;
    if (!accountKey) return;
    queryClient.removeQueries({ queryKey: ["history", accountKey] });
  }, [queryClient, isClient, accountKey]);

  useEffect(() => {
    setBlockTimestamps(new Map());
    fetchingBlocks.current.clear();
  }, [accountKey]);

  useEffect(() => {
    setGateActive(true);
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
    if (!isClient) {
      return false;
    }
    if (typeof window === "undefined") {
      return false;
    }
    return Boolean((window as any).keeta && typeof (window as any).keeta.history === "function");
  }, [isClient]);

  useEffect(() => {
    // no-op; previously logged gating state
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

  useEffect(() => {
    if (enableHistoryQuery) setGateActive(true);
  }, [enableHistoryQuery]);

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
      return fetchProviderHistory(provider, {
        depth: HISTORY_DEPTH,
        cursor: typeof pageParam === "string" && pageParam.length > 0 ? pageParam : undefined,
      });
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
    staleTime: 15_000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: (q) => !q.state.data,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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
    if (typeof window !== "undefined") {
      (window as any).__HISTORY_DEBUG_PAGES__ = pages;
      (window as any).__HISTORY_DEBUG_NORMALIZED__ = normalized;
    }
  }, [pages, normalized]);

  useEffect(() => {
    // no-op; previously logged normalization stats
  }, [allRecords.length, normalized.operations.length, normalized.tokensToFetch.length, normalized.blocksToFetch.length]);

  useEffect(() => {
    if (!normalized.tokensToFetch.length) {
      return;
    }

    for (const tokenId of normalized.tokensToFetch) {
      if (!tokenId) continue;
      if (tokenMetadata[tokenId]) continue;

      const cachedEntry = getCachedTokenMetadata(tokenId);
      if (cachedEntry) {
        setTokenMetadata((prev) => {
          if (prev[tokenId]) {
            return prev;
          }
          return { ...prev, [tokenId]: toCachedTokenMeta(cachedEntry) };
        });
        continue;
      }

      if (fetchingTokenMeta.current.has(tokenId)) continue;
      fetchingTokenMeta.current.add(tokenId);

      void (async () => {
        try {
          const entry = await getTokenMetadata(tokenId);
          if (!entry) {
            return;
          }

          setTokenMetadata((prev) => {
            if (prev[tokenId]) {
              return prev;
            }
            return { ...prev, [tokenId]: toCachedTokenMeta(entry) };
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
    let timer: number | undefined;

    const run = async () => {
      const tasks = pending.map(async (hash) => {
        if (!hash) return { hash: "", iso: null as string | null };
        if (fetchingBlocks.current.has(hash)) return { hash, iso: null as string | null };
        fetchingBlocks.current.add(hash);
        try {
          const blockData = await getBlock(hash);
          const timestampCandidates = [
            (blockData as any)?.timestamp,
            (blockData as any)?.createdAt,
            (blockData as any)?.date,
            (blockData as any)?.time,
            (blockData as any)?.moment,
            (blockData as any)?.header?.timestamp,
            (blockData as any)?.header?.createdAt,
            (blockData as any)?.block?.timestamp,
            (blockData as any)?.block?.createdAt,
            (blockData as any)?.block?.date,
            (blockData as any)?.info?.timestamp,
            (blockData as any)?.info?.createdAt,
            Array.isArray((blockData as any)?.blocks)
              ? (blockData as any)?.blocks?.[0]?.timestamp
              : undefined,
            Array.isArray((blockData as any)?.blocks)
              ? (blockData as any)?.blocks?.[0]?.createdAt
              : undefined,
          ];

          let iso: string | null = null;
          for (const candidate of timestampCandidates) {
            const parsed = parseExplorerDate(candidate as unknown);
            if (parsed) {
              iso = parsed.toISOString();
              break;
            }
          }

          if (typeof window !== "undefined") {
            const storeObj = ((window as any).__HISTORY_DEBUG_BLOCKS__ ??= {});
            if (storeObj && typeof storeObj === "object") {
              (storeObj as Record<string, unknown>)[hash] = blockData;
            }
          }

          return { hash, iso };
        } catch {
          return { hash, iso: null as string | null };
        } finally {
          fetchingBlocks.current.delete(hash);
        }
      });

      const settled = await Promise.allSettled(tasks);
      const updates = new Map<string, string>();
      const unresolved: string[] = [];
      for (const s of settled) {
        if (s.status === "fulfilled") {
          const r = s.value;
          if (r && r.hash && r.iso) {
            updates.set(r.hash, r.iso);
          } else if (r && r.hash) {
            unresolved.push(r.hash);
          }
        }
      }

      if (!cancelled && updates.size > 0) {
        setBlockTimestamps((prev) => {
          const next = new Map(prev);
          for (const [hash, iso] of updates.entries()) {
            if (!next.has(hash)) {
              next.set(hash, iso);
            }
          }
          return next;
        });
      }

      const retryable = unresolved.filter((h) => {
        const count = blockAttempts.current.get(h) ?? 0;
        return count < 3;
      });
      if (!cancelled && retryable.length > 0) {
        retryable.forEach((h) => {
          blockAttempts.current.set(h, (blockAttempts.current.get(h) ?? 0) + 1);
        });
        if (typeof window !== "undefined") {
          timer = window.setTimeout(() => {
            setRetryTick((t) => t + 1);
          }, 1500);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (typeof window !== "undefined" && timer) {
        window.clearTimeout(timer);
      }
    };
  }, [normalized.blocksToFetch, blockTimestamps, retryTick]);

  const hydratedOperations = useMemo(() => {
    if (!blockTimestamps.size) {
      return normalized.operations;
    }

    return normalized.operations.map((operation) => {
      const block = operation.block;
      if (!block) {
        return operation;
      }

      const blockHash = block.$hash;
      if (!blockHash) {
        return operation;
      }

      const isPlaceholder = (block as any)?.placeholderDate === true;
      const hasValidDate = (() => {
        if (!block.date) return false;
        const parsed = new Date(block.date as string);
        return !Number.isNaN(parsed.getTime());
      })();

      if (!isPlaceholder && hasValidDate) {
        return operation;
      }

      const replacementDate = blockTimestamps.get(blockHash);
      if (!replacementDate) {
        return operation;
      }

      return {
        ...operation,
        block: {
          ...block,
          date: replacementDate,
          placeholderDate: false,
        },
      };
    });
  }, [normalized.operations, blockTimestamps]);

  const firstPageReady = useMemo(() => {
    const sortTime = (op: any): number =>
      typeof (op as any)?.blockTimestamp === "number"
        ? (op as any).blockTimestamp as number
        : ((op as any)?.block?.date ? new Date((op as any).block.date as string).getTime() : 0) || 0;
    const sorted = hydratedOperations.slice().sort((a: any, b: any) => sortTime(b) - sortTime(a));
    const page = sorted.slice(0, 10);
    for (const op of page) {
      const hasTs = typeof (op as any)?.blockTimestamp === "number"
        || (((op as any)?.block?.placeholderDate !== true)
          && (op as any)?.block?.date
          && !Number.isNaN(new Date((op as any).block.date as string).getTime()));
      const tokenId = (op as any)?.tokenLookupId as string | undefined;
      let hasMeta = true;
      if (tokenId && tokenId !== "base") {
        const dec = typeof (op as any)?.tokenDecimals === "number"
          || typeof ((op as any)?.tokenMetadata?.decimals) === "number";
        const ft = (op as any)?.tokenMetadata?.fieldType;
        const hasFieldType = ft === "decimalPlaces" || ft === "decimals";
        hasMeta = dec && hasFieldType;
      }
      if (!hasTs || !hasMeta) return false;
    }
    return true;
  }, [hydratedOperations]);

  useEffect(() => {
    let timer: number | undefined;
    const busy = historyQuery.fetchStatus === "fetching"
      || historyQuery.isRefetching
      || capabilityLoading
      || hydratedOperations.length === 0
      || !firstPageReady;
    if (busy) {
      setGateActive(true);
    } else {
      if (typeof window !== "undefined") {
        timer = window.setTimeout(() => setGateActive(false), 200);
      } else {
        setGateActive(false);
      }
    }
    return () => {
      if (typeof window !== "undefined" && timer) {
        window.clearTimeout(timer);
      }
    };
  }, [historyQuery.fetchStatus, historyQuery.isRefetching, capabilityLoading, hydratedOperations.length, firstPageReady]);

  useEffect(() => {
    if (!blockTimestamps.size) {
      return;
    }

    const remainingPlaceholders = new Set<string>();
    for (const operation of normalized.operations) {
      const block = operation.block;
      if (!block) continue;
      const blockHash = block.$hash;
      if (!blockHash) continue;
      const isPlaceholder = (block as any)?.placeholderDate === true;
      const isValidDate = (() => {
        if (!block.date) return false;
        const parsed = new Date(block.date as string);
        return !Number.isNaN(parsed.getTime());
      })();
      if (isPlaceholder || !isValidDate) {
        remainingPlaceholders.add(blockHash);
      }
    }

    if (remainingPlaceholders.size === 0) {
      fetchingBlocks.current.clear();
      return;
    }

    const hydratedHashes = Array.from(blockTimestamps.keys());
    for (const hash of hydratedHashes) {
      if (!remainingPlaceholders.has(hash)) {
        fetchingBlocks.current.delete(hash);
      }
    }
  }, [blockTimestamps, normalized.operations]);

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
    (!awaitingWallet && hasHistoryCapability && (isLoading || capabilityLoading) && hydratedOperations.length === 0)
    || gateActive;

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
                {(!gateActive && statusContent) ? (
                  <div className="flex h-full items-center justify-center rounded-xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-8 text-sm text-muted">
                    {statusContent}
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                    <div className="shrink-0">
                      <ExplorerOperationsTable
                        operations={gateActive ? [] : hydratedOperations}
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
