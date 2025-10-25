"use client";

import Link from "next/link";

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

import {
  formatRelativeTime,
  summarizeOperation,
} from "../utils/operation-format";
import {
  resolveExplorerPath,
  truncateIdentifier,
} from "../utils/resolveExplorerPath";

interface ExplorerOperationsTableProps {
  operations: ExplorerOperation[];
  emptyLabel?: string;
  participantsMode?: 'both' | 'smart';
  loading?: boolean;
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

export default function ExplorerOperationsTable(
  { operations, emptyLabel = "No operations available.", participantsMode = 'both', loading = false }: ExplorerOperationsTableProps,
): React.JSX.Element {
  if (loading && !operations.length) {
    // Render table shell with skeleton rows
    return (
      <div className="overflow-hidden rounded-2xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_3%,transparent)]">
        <div className="min-w-[720px]">
          <Table className="w-full table-fixed">
            <TableHeader className="bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] text-xs uppercase tracking-[0.3em] text-muted">
              <TableRow className="border-hairline text-muted">
                <TableHead className="px-6 py-3 w-[220px] whitespace-nowrap">Block</TableHead>
                <TableHead className="px-6 py-3 w-[140px] whitespace-nowrap">Type</TableHead>
                <TableHead className="px-6 py-3 w-[280px]">Participants</TableHead>
                <TableHead className="px-6 py-3 w-[320px]">Token</TableHead>
                <TableHead className="px-6 py-3 w-[120px] whitespace-nowrap">Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={`sk-${i}`} className="border-hairline">
                  <TableCell className="px-6 py-4 w-[220px]">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-32 bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                      <Skeleton className="h-3 w-24 bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 w-[140px]">
                    <Skeleton className="h-4 w-20 bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                  </TableCell>
                  <TableCell className="px-6 py-4 w-[280px]">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-40 bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                      <Skeleton className="h-3 w-36 bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 w-[320px]">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-44 bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                      <Skeleton className="h-3 w-40 bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 w-[120px]">
                    <Skeleton className="h-4 w-16 bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
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
                <TableHead className="px-6 py-3 w-[220px] whitespace-nowrap">Block</TableHead>
                <TableHead className="px-6 py-3 w-[140px] whitespace-nowrap">Type</TableHead>
                <TableHead className="px-6 py-3 w-[280px]">Participants</TableHead>
                <TableHead className="px-6 py-3 w-[320px]">Token</TableHead>
                <TableHead className="px-6 py-3 w-[120px] whitespace-nowrap">Age</TableHead>
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
    <div className="overflow-hidden rounded-2xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_3%,transparent)]">
      <div className="min-w-[720px]">
        <Table className="w-full table-fixed">
          <TableHeader className="bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] text-xs uppercase tracking-[0.3em] text-muted">
            <TableRow className="border-hairline text-muted">
              <TableHead className="px-6 py-3 w-[220px] whitespace-nowrap">Block</TableHead>
              <TableHead className="px-6 py-3 w-[140px] whitespace-nowrap">Type</TableHead>
              <TableHead className="px-6 py-3 w-[280px]">Participants</TableHead>
              <TableHead className="px-6 py-3 w-[320px]">Token</TableHead>
              <TableHead className="px-6 py-3 w-[120px] whitespace-nowrap">Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operations.map((operation, idx) => {
              const summary = summarizeOperation(operation);
              if (process.env.NODE_ENV === "development") {
                console.log("[ExplorerOperationsTable] Rendering operation", {
                  type: operation.type,
                  blockHash: operation.block.$hash,
                  rawOperation: operation,
                  summary,
                });
              }
              const blockLink = `/explorer/block/${operation.block.$hash}`;
              const fromLink = resolveLink(summary.participants.from ?? null);
              const toLink = resolveLink(summary.participants.to ?? null);
              const typeUpper = (operation.type || '').toUpperCase();
              const showOnlyTo = participantsMode === 'smart' && typeUpper === 'SEND';
              const showOnlyFrom = participantsMode === 'smart' && typeUpper === 'RECEIVE';
              const relative = formatRelativeTime(summary.timestamp) ?? "Just now";

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
              
              const tickerLabel = enrichedTicker ?? metadataTicker ?? nestedTicker ?? null;

              // Try to extract ticker from formatted amount if no ticker found
              let extractedTicker = tickerLabel;
              if (!extractedTicker && enrichedFormattedAmount) {
                const match = enrichedFormattedAmount.match(/\s+([A-Z]{2,10})$/);
                if (match) {
                  extractedTicker = match[1];
                }
              }
              
              const amountWithoutTicker = enrichedFormattedAmount
                ? enrichedFormattedAmount.replace(/\s+[A-Z]{2,10}$/u, '').trim()
                : null;
              const amountDisplay =
                (amountWithoutTicker && amountWithoutTicker.length > 0
                  ? amountWithoutTicker
                  : resolvedAmount ?? null);

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
              if (process.env.NODE_ENV === "development" && !rawTokenIdentifier) {
                console.warn("[ExplorerOperationsTable] Missing token identifier", {
                  operationType: operation.type,
                  primaryOp,
                  sendOp,
                  receiveOp,
                  operationAny,
                  tokenCandidates,
                });
              }
              
              // Enhanced metadata name extraction from multiple sources
              const metadataName = 
                (typeof operationAny.tokenMetadata?.name === "string" && operationAny.tokenMetadata.name.trim().length > 0 ? operationAny.tokenMetadata.name.trim() : null) ||
                (typeof (primaryOp as any).tokenMetadata?.name === "string" && (primaryOp as any).tokenMetadata.name.trim().length > 0 ? (primaryOp as any).tokenMetadata.name.trim() : null) ||
                (typeof (sendOp as any).tokenMetadata?.name === "string" && (sendOp as any).tokenMetadata.name.trim().length > 0 ? (sendOp as any).tokenMetadata.name.trim() : null) ||
                (typeof (receiveOp as any).tokenMetadata?.name === "string" && (receiveOp as any).tokenMetadata.name.trim().length > 0 ? (receiveOp as any).tokenMetadata.name.trim() : null);

              const metadataNameToRender = metadataName && extractedTicker && metadataName.toUpperCase() === extractedTicker.toUpperCase()
                ? null
                : metadataName;

              const tickerUsedInPrimary = extractedTicker
                ? Boolean(
                    (amountDisplay ?? '')
                      .toUpperCase()
                      .includes(extractedTicker.toUpperCase()),
                  )
                : false;
              const shortIdentifier = rawTokenIdentifier
                ? rawTokenIdentifier.length > 32
                  ? truncateIdentifier(rawTokenIdentifier, 12, 10)
                  : rawTokenIdentifier
                : null;
              let primaryLine = amountDisplay ?? extractedTicker ?? "Unknown amount";
              if (extractedTicker === 'UNKNOWN' && typeof primaryLine === 'string') {
                primaryLine = primaryLine.replace(/\s+UNKNOWN$/, '');
              }
              
              // Enhanced logic for determining when to show "Unknown token"
              const hasTokenMetadata = Boolean(metadataName || extractedTicker);
              const hasTokenIdentifier = Boolean(tokenLink || shortIdentifier);
              const hasValidTokenInfo = hasTokenMetadata || hasTokenIdentifier;
              
              const shouldShowUnknownToken = !hasValidTokenInfo;

              return (
                <TableRow
                  key={`${operation.block.$hash}-${operation.voteStapleHash ?? operation.type}-${idx}`}
                  className="border-hairline text-sm text-foreground"
                >
                  <TableCell className="px-6 py-4 w-[220px] align-top">
                    <div className="flex flex-col gap-1 overflow-hidden text-ellipsis">
                      <Link
                        href={blockLink}
                        className="font-medium text-accent hover:text-foreground"
                      >
                        {truncateIdentifier(operation.block.$hash, 12, 8)}
                      </Link>
                      {operation.block.account ? (
                        <span className="text-xs text-muted truncate">
                          {truncateIdentifier(operation.block.account)}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 w-[140px] text-xs font-semibold uppercase tracking-[0.3em] text-muted align-top">
                    {operation.type}
                  </TableCell>
                  <TableCell className="px-6 py-4 w-[280px] align-top">
                    <div className="flex flex-col gap-1 text-sm text-subtle overflow-hidden">
                      {(!showOnlyTo) && (
                        <span>
                          From{" "}
                          {fromLink ? (
                            <Link href={fromLink.href} className="text-accent hover:text-foreground">
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
                            <Link href={toLink.href} className="text-accent hover:text-foreground">
                              {toLink.label}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 w-[320px] text-sm text-subtle align-top">
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <span className="text-sm text-foreground truncate">
                        {primaryLine}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted overflow-hidden">
                        {metadataNameToRender ? (
                          <span className="truncate max-w-[200px]">{metadataNameToRender}</span>
                        ) : null}
                        {!tickerUsedInPrimary && extractedTicker && extractedTicker !== 'UNKNOWN' ? (
                          <span>{extractedTicker}</span>
                        ) : null}
                        {!extractedTicker ? (
                          tokenLink ? (
                          <Link
                            href={tokenLink.href}
                            className="text-xs text-accent hover:text-foreground"
                          >
                            {tokenLink.label}
                          </Link>
                        ) : shortIdentifier ? (
                          <span>{shortIdentifier}</span>
                        ) : null) : null}
                        {shouldShowUnknownToken ? <span>Unknown token</span> : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 w-[120px] text-sm text-muted align-top whitespace-nowrap">
                    {relative}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
