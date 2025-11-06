"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExplorerOperation } from "@/lib/explorer/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

import {
  formatRelativeTime,
  summarizeOperation,
  parseExplorerDate,
} from "../utils/operation-format";
import {
  resolveExplorerPath,
  truncateIdentifier,
} from "../utils/resolveExplorerPath";
import { formatTokenAmount as formatTokenAmountPlain } from "@/app/lib/token-utils";

interface ExplorerOperationsTableProps {
  operations: ExplorerOperation[];
  emptyLabel?: string;
  participantsMode?: 'both' | 'smart';
  loading?: boolean;
  pageSize?: number;
  assumeSorted?: boolean;
}

const MAX_TOKEN_IDENTIFIER_DEPTH = 4;

function resolveTokenIdentifier(candidate: unknown, depth = 0): string | null {
  if (!candidate || depth > MAX_TOKEN_IDENTIFIER_DEPTH) {
    return null;
  }

  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof candidate === "number" || typeof candidate === "bigint") {
    return String(candidate);
  }

  if (Array.isArray(candidate)) {
    for (const value of candidate) {
      const resolved = resolveTokenIdentifier(value, depth + 1);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }

  if (typeof candidate === "object") {
    const record = candidate as Record<string, unknown>;
    
    // Enhanced prioritized keys for token identification
    const prioritizedKeys = [
      "publicKeyString",
      "publicKey", 
      "address",
      "token",
      "tokenAccount",
      "tokenAddress", 
      "tokenPublicKey",
      "tokenId",
      "account",
      "id",
      "value",
      "$hash",
      "hash",
      // Additional Keeta-specific fields
      "identifier",
      "target",
      "destination",
      "recipient",
      "sender",
    ];

    for (const key of prioritizedKeys) {
      if (!(key in record)) {
        continue;
      }
      const value = record[key];
      if (value === undefined || value === null) {
        continue;
      }
      const resolved = resolveTokenIdentifier(value, depth + 1);
      if (resolved) {
        return resolved;
      }
    }

    // Try to extract from nested objects
    for (const value of Object.values(record)) {
      if (value === undefined || value === null) {
        continue;
      }
      const resolved = resolveTokenIdentifier(value, depth + 1);
      if (resolved) {
        return resolved;
      }
    }

    // Try toString method as last resort
    if (typeof record.toString === "function") {
      try {
        const result = String(record.toString()).trim();
        if (result.length > 0 && result !== "[object Object]") {
          return result;
        }
      } catch (error) {
        // Ignore toString errors
      }
    }
  }

  return null;
}

function resolveLink(
  identifier: string | null | undefined,
): { href: string; label: string } | null {
  if (!identifier) {
    return null;
  }
  const path = resolveExplorerPath(identifier);
  if (!path) {
    return null;
  }
  return {
    href: path,
    label: truncateIdentifier(identifier, 10, 8),
  };
}

export default function ExplorerOperationsTable({
  operations,
  emptyLabel = "No operations available.",
  participantsMode = 'both',
  loading = false,
  pageSize: pageSizeProp = 5,
  assumeSorted = false,
}: ExplorerOperationsTableProps): React.JSX.Element {
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = Math.max(1, pageSizeProp);
  // Stable sort by block date desc, then hash to avoid jitter between renders
  const sortedOperations = useMemo(() => {
    if (assumeSorted) return operations;
    const copy = operations.slice();
    copy.sort((a, b) => {
      const at = typeof (a as any).blockTimestamp === 'number'
        ? (a as any).blockTimestamp as number
        : (parseExplorerDate(a.block.date)?.getTime() ?? 0);
      const bt = typeof (b as any).blockTimestamp === 'number'
        ? (b as any).blockTimestamp as number
        : (parseExplorerDate(b.block.date)?.getTime() ?? 0);
      const ad = at;
      const bd = bt;
      if (bd !== ad) return bd - ad;
      const ah = (a.block.$hash || '').toString();
      const bh = (b.block.$hash || '').toString();
      return ah.localeCompare(bh);
    });
    return copy;
  }, [operations]);
  const pageCount = Math.max(1, Math.ceil(sortedOperations.length / pageSize));
  useEffect(() => {
    setPageIndex((prev) => Math.min(prev, pageCount - 1));
  }, [sortedOperations.length, pageCount]);
  const pageRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return sortedOperations.slice(start, start + pageSize);
  }, [sortedOperations, pageIndex, pageSize]);
  if (loading && !operations.length) {
    // Render table shell with skeleton rows
    return (
      <div className="overflow-hidden rounded-2xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_3%,transparent)]">
        <div className="min-w-[720px]">
          <Table className="w-full table-fixed">
            <TableHeader className="bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] text-xs uppercase tracking-[0.3em] text-muted">
              <TableRow className="border-hairline text-muted">
                <TableHead className="px-6 py-3 w-[160px] whitespace-nowrap">Age</TableHead>
                <TableHead className="px-6 py-3 w-[220px] whitespace-nowrap">Block</TableHead>
                <TableHead className="px-6 py-3 w-[180px] whitespace-nowrap">Type</TableHead>
                <TableHead className="px-6 py-3 w-[260px]">Participants</TableHead>
                <TableHead className="px-6 py-3 w-[220px] text-right">Token</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={`sk-${i}`} className="border-hairline">
                  <TableCell className="px-6 py-4 w-[160px]">
                    <Skeleton className="h-4 w-16 bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                  </TableCell>
                  <TableCell className="px-6 py-4 w-[220px]">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-32 bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                      <Skeleton className="h-3 w-24 bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 w-[180px]">
                    <Skeleton className="h-4 w-20 bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                  </TableCell>
                  <TableCell className="px-6 py-4 w-[280px]">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-40 bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                      <Skeleton className="h-3 w-36 bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 w-[220px] text-right">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-44 bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                      <Skeleton className="h-3 w-40 bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }
  if (!operations.length) {
    return (
      <div className="rounded-2xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_3%,transparent)]">
        <div className="min-w-[720px]">
          <Table className="w-full table-fixed">
            <TableHeader className="bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] text-xs uppercase tracking-[0.3em] text-muted">
              <TableRow className="border-hairline text-muted">
                <TableHead className="px-6 py-3 w-[160px] whitespace-nowrap text-right">Age</TableHead>
                <TableHead className="px-6 py-3 w-[220px] whitespace-nowrap">Block</TableHead>
                <TableHead className="px-6 py-3 w-[180px] whitespace-nowrap">Type</TableHead>
                <TableHead className="px-6 py-3 w-[260px]">Participants</TableHead>
                <TableHead className="px-6 py-3 w-[220px] text-right">Token</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-hairline">
                <TableCell colSpan={5} className="px-6 py-6 text-sm text-muted">{emptyLabel}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_3%,transparent)]">
        <div className="min-w-[720px]">
          <Table className="w-full table-fixed">
          <TableHeader className="bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] text-xs uppercase tracking-[0.3em] text-muted">
            <TableRow className="border-hairline text-muted">
              <TableHead className="px-6 py-3 w-[160px] whitespace-nowrap">Age</TableHead>
              <TableHead className="px-6 py-3 w-[220px] whitespace-nowrap">Block</TableHead>
              <TableHead className="px-6 py-3 w-[180px] whitespace-nowrap">Type</TableHead>
              <TableHead className="px-6 py-3 w-[260px]">Participants</TableHead>
              <TableHead className="px-6 py-3 w-[220px] text-right">Token</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((operation, idx) => {
              const summary = summarizeOperation(operation);
              const blockLink = `/explorer/block/${operation.block.$hash}`;
              const fromLink = resolveLink(summary.participants.from ?? null);
              const toLink = resolveLink(summary.participants.to ?? null);
              const showOnlyTo = false;
              const showOnlyFrom = false;
              const relative = formatRelativeTime(summary.timestamp) ?? "—";
              const absolute = summary.timestamp ? summary.timestamp.toISOString() : null;
              const rowKey = (operation as any).rowId ?? `${operation.block.$hash}:${idx}`;

              const primaryOp = operation.operation ?? {};
              const sendOp = operation.operationSend ?? {};
              const receiveOp = operation.operationReceive ?? {};

              const resolvedAmount =
                (typeof primaryOp.amount === "string" && primaryOp.amount) ? primaryOp.amount :
                (typeof sendOp.amount === "string" && sendOp.amount) ? sendOp.amount :
                (typeof receiveOp.amount === "string" && receiveOp.amount) ? receiveOp.amount :
                null;

              const operationAny = operation as any;
              // Enhanced token metadata extraction
              const enrichedFormattedAmount = typeof operationAny.formattedAmount === "string" && operationAny.formattedAmount.trim().length > 0
                ? operationAny.formattedAmount.trim()
                : null;
              // Detect grouped/combined rows and multi-token formatted output
              const isGroupedCombined: boolean = operationAny.groupedCombined === true;
              const isMultiToken: boolean = isGroupedCombined 
                || (operationAny?.tokenMetadata?.name === 'Multiple tokens')
                || (typeof enrichedFormattedAmount === 'string' && enrichedFormattedAmount.includes(' + '));
              
              // Extract ticker from multiple sources
              const enrichedTicker = typeof operationAny.tokenTicker === "string" && operationAny.tokenTicker.trim().length > 0
                ? operationAny.tokenTicker.trim()
                : null;
              const metadataTicker = typeof operationAny.tokenMetadata?.ticker === "string" && operationAny.tokenMetadata.ticker.trim().length > 0
                ? operationAny.tokenMetadata.ticker.trim()
                : null;
              
              // Try to extract ticker from nested operations
              const nestedTicker = 
                (typeof (primaryOp as any).tokenMetadata?.ticker === "string" && (primaryOp as any).tokenMetadata.ticker.trim().length > 0 ? (primaryOp as any).tokenMetadata.ticker.trim() : null) ||
                (typeof (sendOp as any).tokenMetadata?.ticker === "string" && (sendOp as any).tokenMetadata.ticker.trim().length > 0 ? (sendOp as any).tokenMetadata.ticker.trim() : null) ||
                (typeof (receiveOp as any).tokenMetadata?.ticker === "string" && (receiveOp as any).tokenMetadata.ticker.trim().length > 0 ? (receiveOp as any).tokenMetadata.ticker.trim() : null);
              
              const baseTickerLabel = enrichedTicker ?? metadataTicker ?? nestedTicker ?? null;

              // Try to extract ticker from formatted amount if no ticker found
              let extractedTicker = baseTickerLabel;
              if (!extractedTicker && enrichedFormattedAmount && !isMultiToken) {
                const match = enrichedFormattedAmount.match(/\s+([A-Z]{2,10})$/);
                if (match) {
                  extractedTicker = match[1];
                }
              }
              
              const amountWithoutTicker = enrichedFormattedAmount
                ? (isMultiToken ? enrichedFormattedAmount : enrichedFormattedAmount.replace(/\s+[A-Z]{2,10}$/u, '').trim())
                : null;
              // Prefer client-side normalized amount if we have rawAmount + decimals
              const rawForCompute: string | null =
                (typeof operationAny.rawAmount === "string" && operationAny.rawAmount.trim().length > 0)
                  ? operationAny.rawAmount.trim()
                  : (resolvedAmount ?? null);
              const decimalsForCompute: number | undefined =
                typeof operationAny.tokenDecimals === "number"
                  ? operationAny.tokenDecimals
                  : (typeof operationAny.tokenMetadata?.decimals === "number"
                      ? operationAny.tokenMetadata.decimals
                      : undefined);
              const fieldTypeForCompute: 'decimalPlaces' | 'decimals' =
                operationAny.tokenMetadata?.fieldType === 'decimalPlaces' ? 'decimalPlaces' : 'decimals';
              let normalizedAmountClient: string | null = null;
              if (!isMultiToken && rawForCompute && typeof decimalsForCompute === 'number') {
                try {
                  normalizedAmountClient = formatTokenAmountPlain(rawForCompute, decimalsForCompute, fieldTypeForCompute, decimalsForCompute);
                  try { console.debug('[ExplorerTable] normalized client amount', { rawForCompute, decimalsForCompute, fieldTypeForCompute, out: normalizedAmountClient }); } catch {}
                } catch (e) {
                  try { console.warn('[ExplorerTable] normalize failed', { error: (e as Error)?.message }); } catch {}
                  normalizedAmountClient = null;
                }
              }
              const amountDisplay = isMultiToken && enrichedFormattedAmount
                ? enrichedFormattedAmount
                : ((normalizedAmountClient && normalizedAmountClient.length > 0)
                  ? normalizedAmountClient
                  : (amountWithoutTicker && amountWithoutTicker.length > 0
                      ? amountWithoutTicker
                      : resolvedAmount ?? null));

              // Enhanced token candidate extraction with better debugging
              const tokenCandidates = [
                primaryOp.token,
                sendOp.token,
                receiveOp.token,
                operationAny.token,
                operationAny.tokenAddress,
                operationAny.tokenId,
                operationAny.tokenMetadata?.address,
                operationAny.tokenMetadata?.publicKey,
                operationAny.tokenMetadata?.publicKeyString,
                // Additional candidates from nested operations
                operationAny.operation?.token,
                operationAny.operationSend?.token,
                operationAny.operationReceive?.token,
                operationAny.operationForward?.token,
              ];

              let rawTokenIdentifier: string | null = null;
              for (const candidate of tokenCandidates) {
                const resolved = resolveTokenIdentifier(candidate);
                if (resolved && resolved.trim().length > 0) {
                  rawTokenIdentifier = resolved;
                  break;
                }
              }

              const tokenLink = rawTokenIdentifier ? resolveLink(rawTokenIdentifier) : null;
              const displayTicker = extractedTicker && extractedTicker !== "UNKNOWN" ? extractedTicker : null;
              const shortIdentifier = rawTokenIdentifier
                ? rawTokenIdentifier.length > 32
                  ? truncateIdentifier(rawTokenIdentifier, 12, 10)
                  : rawTokenIdentifier
                : null;
              const amountPart = amountDisplay && amountDisplay.length > 0 ? amountDisplay : null;

              const hasMultiTokenDisplay = Boolean(isMultiToken && enrichedFormattedAmount);
              let amountLabel: string | null = hasMultiTokenDisplay ? enrichedFormattedAmount : amountPart;
              let tokenTickerLabel: string | null = hasMultiTokenDisplay ? null : displayTicker;

              if (!amountLabel || amountLabel.trim().length === 0) {
                amountLabel = null;
              }
              if (!tokenTickerLabel || tokenTickerLabel.trim().length === 0) {
                tokenTickerLabel = null;
              }

              if (!amountLabel && !tokenTickerLabel) {
                const fallbackLabel = (tokenLink ? tokenLink.label : null) ?? shortIdentifier ?? "Unknown token";
                amountLabel = fallbackLabel;
              }

              const tokenTitle = [amountLabel, tokenTickerLabel].filter(Boolean).join(" ") || undefined;
              const tokenContent = (
                <span className="flex items-baseline justify-end">
                  {amountLabel ? (
                    <span className={tokenLink ? "text-sm text-foreground group-hover:text-accent" : "text-sm text-foreground"}>
                      {amountLabel}
                    </span>
                  ) : null}
                  {tokenTickerLabel ? (
                    <span className={`${amountLabel ? "ml-2 " : ""}text-sm text-muted`}> 
                      {tokenTickerLabel}
                    </span>
                  ) : null}
                </span>
              );

              const tokenPrimaryNode = tokenLink ? (
                <Link
                  href={tokenLink.href}
                  className="group block text-right hover:underline"
                  title={tokenTitle}
                >
                  {tokenContent}
                </Link>
              ) : (
                <span className="block text-right" title={tokenTitle}>
                  {tokenContent}
                </span>
              );

              return (
                <TableRow
                  key={rowKey}
                  className="border-hairline text-sm text-foreground"
                >
                  <TableCell className="px-6 py-4 w-[160px] text-sm text-muted align-top whitespace-nowrap" title={absolute ?? undefined}>
                    {relative}
                  </TableCell>
                  <TableCell className="px-6 py-4 w-[220px] align-top">
                    <div className="flex flex-col gap-1 overflow-hidden text-ellipsis">
                      <Link
                        href={blockLink}
                        className="font-medium text-foreground hover:text-accent hover:underline"
                      >
                        {truncateIdentifier(operation.block.$hash, 12, 8)}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 w-[180px] text-xs font-semibold uppercase tracking-[0.3em] text-muted align-top">
                    {operation.type}
                  </TableCell>
                  <TableCell className="px-6 py-4 w-[280px] align-top">
                    <div className="flex flex-col gap-1 text-sm text-foreground overflow-hidden">
                      {(!showOnlyTo) && (
                        <span>
                          From{" "}
                          {fromLink ? (
                            <Link href={fromLink.href} className="text-foreground hover:text-accent hover:underline">
                              {fromLink.label}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </span>
                      )}
                      {(!showOnlyFrom) && (
                        <span>
                          To{" "}
                          {toLink ? (
                            <Link href={toLink.href} className="text-foreground hover:text-accent hover:underline">
                              {toLink.label}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 w-[220px] text-sm text-subtle align-top text-right">
                    <div className="flex flex-col items-end gap-1 overflow-hidden text-right">
                      {tokenPrimaryNode}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      </div>
      <div className="flex items-center px-4 pt-3">
        <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">&nbsp;</div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 min-w-[2.5rem] px-2"
            onClick={() => setPageIndex(0)}
            disabled={pageIndex === 0}
            aria-label="Go to first page"
          >
            {"<<"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 min-w-[2.5rem] px-2"
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={pageIndex === 0}
            aria-label="Go to previous page"
          >
            {"<"}
          </Button>
          <span className="px-1 text-sm font-medium">
            Page {pageIndex + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 min-w-[2.5rem] px-2"
            onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
            disabled={pageIndex >= pageCount - 1}
            aria-label="Go to next page"
          >
            {">"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 min-w-[2.5rem] px-2"
            onClick={() => setPageIndex(pageCount - 1)}
            disabled={pageIndex >= pageCount - 1}
            aria-label="Go to last page"
          >
            {">>"}
          </Button>
        </div>
      </div>
    </>
  );
}
