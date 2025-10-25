"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ExplorerOperationsTable from "./ExplorerOperationsTable";
import {
  parseExplorerOperation,
  type ExplorerOperation,
} from "@/lib/explorer/client";

type WalletHistoryRecord = {
  id?: string;
  hash?: string;
  block?: string;
  createdAt?: string;
  date?: string | number | Date;
  timestamp?: number | string | Date;
  account?: string;
  amount?: string | number | bigint;
  rawAmount?: string | number | bigint;
  formattedAmount?: string;
  token?: string;
  tokenAddress?: string;
  tokenTicker?: string;
  tokenDecimals?: number;
  tokenMetadata?: unknown;
  metadata?: unknown;
  from?: string;
  to?: string;
  operationType?: string | number;
  voteStaple?: {
    hash?: string;
    blocks?: Array<{
      hash?: string;
      $hash?: string;
      date?: string;
      createdAt?: string;
      timestamp?: number | string | Date;
      account?: string;
      operations?: unknown[];
    }>;
    operations?: unknown[];
  };
  operations?: unknown[];
};

const FALLBACK_MESSAGE =
  "Connect your Keeta wallet to pull recent on-chain activity in real time.";

function coerceString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return undefined;
}

function coerceAmount(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return coerceString(value);
}

function resolveDateValue(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (!candidate && candidate !== 0) {
      continue;
    }
    if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
      return candidate.toISOString();
    }
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      const normalized = new Date(candidate);
      if (!Number.isNaN(normalized.getTime())) {
        return normalized.toISOString();
      }
    }
    if (typeof candidate === "string") {
      const parsed = new Date(candidate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }
  return new Date().toISOString();
}

function normalizeMetadata(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "object") {
    return value;
  }
  return undefined;
}

export default function ExplorerRecentActivityCard(): React.JSX.Element {
  const [operations, setOperations] = useState<ExplorerOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        if (typeof window === "undefined" || !window.keeta?.history) {
          setOperations([]);
          setError(FALLBACK_MESSAGE);
          return;
        }

        const history = await window.keeta.history({
          depth: 40,
          cursor: null,
          includeOperations: true,
          includeTokenMetadata: true,
        } as any);

        if (!history || cancelled) {
          return;
        }

        const records: WalletHistoryRecord[] = Array.isArray(history.records)
          ? history.records
          : [];

        const collected: ExplorerOperation[] = [];
        const seenKeys = new Set<string>();

        const tryAdd = (candidate: unknown, record: WalletHistoryRecord) => {
          if (!candidate || typeof candidate !== "object") {
            return;
          }

          const op = candidate as Record<string, any>;
          const typeRaw = op.type;
          const blockHash =
            record.block ??
            record.hash ??
            record.id ??
            (typeof op.block === "string" ? (op.block as string) : null);

          if (!blockHash || typeof blockHash !== "string") {
            return;
          }

          const normalizedType =
            typeof typeRaw === "string"
              ? typeRaw.toUpperCase()
              : "UNKNOWN";

          const fallbackAmount =
            coerceAmount(op.amount ?? op.rawAmount) ??
            coerceAmount(record.amount ?? record.rawAmount);
          const fallbackToken =
            coerceString(op.token ?? op.tokenAddress) ??
            coerceString(record.token ?? record.tokenAddress);
          const fallbackFrom =
            coerceString(op.from) ??
            coerceString(record.from ?? record.account);
          const fallbackTo =
            coerceString(op.to ?? op.toAccount) ??
            coerceString(record.to);
          const fallbackFormatted =
            coerceString(op.formattedAmount) ??
            coerceString(record.formattedAmount);
          const fallbackTicker =
            coerceString(op.tokenTicker) ??
            coerceString(record.tokenTicker);
          const fallbackDecimals =
            typeof (op.tokenDecimals ?? record.tokenDecimals) === "number"
              ? Number(op.tokenDecimals ?? record.tokenDecimals)
              : undefined;
          const fallbackMetadata =
            normalizeMetadata(op.tokenMetadata) ??
            normalizeMetadata(record.tokenMetadata ?? record.metadata);

          const block = {
            $hash: blockHash,
            date:
              resolveDateValue(
                op.date,
                record.date,
                record.createdAt,
                record.timestamp,
              ),
            account:
              coerceString(op.account ?? record.account ?? record.from),
          };

          const primarySource =
            (typeof op.operation === "object" && op.operation !== null
              ? (op.operation as Record<string, any>)
              : op) ?? {};

          const operation: Record<string, any> = {
            ...(primarySource as Record<string, any>),
          };

          const applyFallbacks = (
            target: Record<string, any> | undefined,
          ): Record<string, any> | undefined => {
            if (!target) {
              return undefined;
            }
            if (fallbackAmount && target.amount === undefined) {
              target.amount = fallbackAmount;
            }
            if (fallbackAmount && target.rawAmount === undefined) {
              target.rawAmount = fallbackAmount;
            }
            if (fallbackToken && target.token === undefined) {
              target.token = fallbackToken;
            }
            if (fallbackMetadata && target.tokenMetadata === undefined) {
              target.tokenMetadata = fallbackMetadata;
            }
            if (fallbackFrom && target.from === undefined) {
              target.from = fallbackFrom;
            }
            if (fallbackTo && target.to === undefined) {
              target.to = fallbackTo;
            }
            if (fallbackFormatted && target.formattedAmount === undefined) {
              target.formattedAmount = fallbackFormatted;
            }
            if (fallbackTicker && target.tokenTicker === undefined) {
              target.tokenTicker = fallbackTicker;
            }
            if (
              typeof fallbackDecimals === "number" &&
              target.tokenDecimals === undefined
            ) {
              target.tokenDecimals = fallbackDecimals;
            }
            if (target.operationType === undefined && record.operationType) {
              target.operationType = record.operationType;
            }
            return target;
          };

          const operationSendSource =
            (typeof op.operationSend === "object" && op.operationSend !== null
              ? (op.operationSend as Record<string, any>)
              : typeof (op as Record<string, any>).send === "object" &&
                  (op as Record<string, any>).send !== null
                ? ((op as Record<string, any>).send as Record<string, any>)
                : undefined);
          const operationReceiveSource =
            (typeof op.operationReceive === "object" &&
              op.operationReceive !== null
              ? (op.operationReceive as Record<string, any>)
              : typeof (op as Record<string, any>).receive === "object" &&
                  (op as Record<string, any>).receive !== null
                ? ((op as Record<string, any>).receive as Record<string, any>)
                : undefined);
          const operationForwardSource =
            (typeof op.operationForward === "object" &&
              op.operationForward !== null
              ? (op.operationForward as Record<string, any>)
              : typeof (op as Record<string, any>).forward === "object" &&
                  (op as Record<string, any>).forward !== null
                ? ((op as Record<string, any>).forward as Record<string, any>)
                : undefined);

          let operationSend: Record<string, any> | undefined = operationSendSource
            ? { ...operationSendSource }
            : undefined;
          let operationReceive: Record<string, any> | undefined = operationReceiveSource
            ? { ...operationReceiveSource }
            : undefined;
          let operationForward: Record<string, any> | undefined = operationForwardSource
            ? { ...operationForwardSource }
            : undefined;

          applyFallbacks(operation);
          applyFallbacks(operationSend);
          applyFallbacks(operationReceive);
          applyFallbacks(operationForward);

          if (!operationSend && normalizedType === "SEND") {
            operationSend = applyFallbacks({ ...operation }) ?? { ...operation };
          }
          if (!operationReceive && normalizedType === "RECEIVE") {
            operationReceive =
              applyFallbacks({ ...operation }) ?? { ...operation };
          }

          const operationPayload: Record<string, any> = {
            type: normalizedType,
            voteStapleHash:
              typeof record.voteStaple?.hash === "string"
                ? record.voteStaple.hash
                : blockHash,
            block,
            operation,
            operationSend,
            operationReceive,
            operationForward,
            amount: fallbackAmount ?? coerceAmount(operation.amount),
            rawAmount:
              fallbackAmount ??
              coerceAmount(operation.rawAmount ?? operation.amount),
            formattedAmount:
              fallbackFormatted ?? coerceString(operation.formattedAmount),
            token:
              fallbackToken ??
              coerceString(
                operation.token ??
                  (operationSend?.token as unknown) ??
                  (operationReceive?.token as unknown),
              ),
            tokenAddress:
              fallbackToken ??
              coerceString(
                operation.tokenAddress ??
                  (operationSend?.tokenAddress as unknown) ??
                  (operationReceive?.tokenAddress as unknown),
              ),
            tokenTicker:
              fallbackTicker ??
              coerceString(
                operation.tokenTicker ??
                  (operationSend?.tokenTicker as unknown) ??
                  (operationReceive?.tokenTicker as unknown),
              ),
            tokenDecimals:
              typeof (operation.tokenDecimals as number | undefined) ===
                "number" && Number.isFinite(operation.tokenDecimals as number)
                ? (operation.tokenDecimals as number)
                : fallbackDecimals,
            tokenMetadata:
              normalizeMetadata(operation.tokenMetadata) ?? fallbackMetadata,
            from:
              fallbackFrom ??
              coerceString(
                operation.from ?? (operationSend?.from as unknown),
              ),
            to:
              fallbackTo ??
              coerceString(
                operation.to ??
                  (operationSend?.to as unknown) ??
                  (operationReceive?.to as unknown),
              ),
            operationType:
              (typeof operation.operationType === "string"
                ? operation.operationType
                : typeof operation.operationType === "number"
                  ? operation.operationType.toString()
                  : undefined) ?? record.operationType ?? typeRaw,
          };

          const parsed = parseExplorerOperation(operationPayload);
          if (parsed) {
            const enriched: ExplorerOperation = {
              ...parsed,
              amount: parsed.amount ?? operationPayload.amount,
              rawAmount: parsed.rawAmount ?? operationPayload.rawAmount,
              formattedAmount:
                parsed.formattedAmount ?? operationPayload.formattedAmount,
              token: parsed.token ?? operationPayload.token,
              tokenAddress:
                parsed.tokenAddress ?? operationPayload.tokenAddress,
              tokenTicker:
                parsed.tokenTicker ?? operationPayload.tokenTicker ?? undefined,
              tokenDecimals:
                parsed.tokenDecimals ?? operationPayload.tokenDecimals,
              tokenMetadata:
                parsed.tokenMetadata ?? operationPayload.tokenMetadata,
              from: parsed.from ?? operationPayload.from,
              to: parsed.to ?? operationPayload.to,
              operationType: parsed.operationType ?? operationPayload.operationType,
            };

            enriched.operation = {
              ...(parsed.operation ?? {}),
              amount:
                parsed.operation?.amount ??
                operationPayload.operation?.amount ??
                operationPayload.amount,
              rawAmount:
                parsed.operation?.rawAmount ??
                operationPayload.operation?.rawAmount ??
                operationPayload.rawAmount,
              token:
                parsed.operation?.token ??
                operationPayload.operation?.token ??
                operationPayload.token,
              tokenMetadata:
                parsed.operation?.tokenMetadata ??
                operationPayload.operation?.tokenMetadata ??
                operationPayload.tokenMetadata,
              from:
                parsed.operation?.from ??
                operationPayload.operation?.from ??
                operationPayload.from,
              to:
                parsed.operation?.to ??
                operationPayload.operation?.to ??
                operationPayload.to,
              formattedAmount:
                parsed.operation?.formattedAmount ??
                operationPayload.operation?.formattedAmount ??
                operationPayload.formattedAmount,
              tokenTicker:
                parsed.operation?.tokenTicker ??
                operationPayload.operation?.tokenTicker ??
                operationPayload.tokenTicker,
              tokenDecimals:
                parsed.operation?.tokenDecimals ??
                operationPayload.operation?.tokenDecimals ??
                operationPayload.tokenDecimals,
            };

            if (enriched.operationSend || operationPayload.operationSend) {
              enriched.operationSend = {
                ...(parsed.operationSend ?? {}),
                ...(operationPayload.operationSend ?? {}),
              };
              applyFallbacks(enriched.operationSend);
            }

            if (enriched.operationReceive || operationPayload.operationReceive) {
              enriched.operationReceive = {
                ...(parsed.operationReceive ?? {}),
                ...(operationPayload.operationReceive ?? {}),
              };
              applyFallbacks(enriched.operationReceive);
            }

            if (enriched.operationForward || operationPayload.operationForward) {
              enriched.operationForward = {
                ...(parsed.operationForward ?? {}),
                ...(operationPayload.operationForward ?? {}),
              };
              applyFallbacks(enriched.operationForward);
            }

            const dedupeKey = `${blockHash}:${normalizedType}:${
              enriched.amount ?? ""
            }:${enriched.token ?? ""}:${
              enriched.operation?.from ?? ""
            }:${enriched.operation?.to ?? ""}`;
            if (seenKeys.has(dedupeKey)) {
              return;
            }
            seenKeys.add(dedupeKey);
            collected.push(enriched);
          }
        };

        for (const record of records) {
          const inline =
            Array.isArray(record.operations) ? record.operations : [];
          const voteStapleOps = Array.isArray(record.voteStaple?.operations)
            ? record.voteStaple?.operations
            : [];
          const blockOps =
            record.voteStaple?.blocks?.flatMap((block) =>
              Array.isArray(block?.operations) ? block.operations : []
            ) ?? [];

          inline.forEach((candidate) => tryAdd(candidate, record));
          voteStapleOps.forEach((candidate) => tryAdd(candidate, record));
          blockOps.forEach((candidate) => tryAdd(candidate, record));
          tryAdd(record, record);

          if (collected.length >= 20) {
            break;
          }
        }

        if (!cancelled) {
          if (!collected.length) {
            setOperations([]);
            setError(FALLBACK_MESSAGE);
          } else {
            setOperations(collected.slice(0, 12));
            setError(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[EXPLORER] Failed to load recent activity", err);
          setOperations([]);
          setError(FALLBACK_MESSAGE);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasData = useMemo(() => operations.length > 0, [operations]);

  return (
    <Card className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
      <CardHeader className="px-6 pb-4">
        <CardTitle className="flex items-center justify-between text-lg font-semibold text-foreground">
          <span>Recent Activity</span>
          <Badge variant="outline" className="text-xs text-muted">
            Live Preview
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-6 pb-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full rounded-lg bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
            <Skeleton className="h-14 w-full rounded-lg bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
            <Skeleton className="h-14 w-full rounded-lg bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
          </div>
        ) : hasData ? (
          <ExplorerOperationsTable
            operations={operations}
            emptyLabel="No recent network activity."
          />
        ) : (
          <div className="rounded-xl border border-hairline bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] px-6 py-8 text-sm text-muted">
            {error ?? FALLBACK_MESSAGE}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
