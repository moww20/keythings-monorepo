"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ExplorerOperationsTable from "./ExplorerOperationsTable";
import { coerceString, coerceAmount, resolveDate } from "@/lib/explorer/mappers";
import {
  parseExplorerOperation,
  type ExplorerOperation,
} from "@/lib/explorer/client";
import { type WalletHistoryRecord } from "@/app/lib/wallet-history";
import { getHistoryForAccount } from "@/lib/explorer/sdk-read-client";
import { useWallet } from "@/app/contexts/WalletContext";

const FALLBACK_MESSAGE =
  "Connect your Keeta wallet to pull recent on-chain activity in real time.";

const HISTORY_DEPTH = 40;

const processedHistoryCache = new Map<string, { fingerprint: string; operations: ExplorerOperation[] }>();

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

function fingerprintHistory(records: WalletHistoryRecord[]): string {
  if (!records.length) {
    return "empty";
  }

  const sample = records.slice(0, 10).map((record) => {
    const primary = coerceString(record.id ?? record.hash ?? record.block) ?? "";
    const timestamp = coerceString(record.timestamp ?? record.date ?? record.createdAt) ?? "";
    const amount = coerceString(record.amount ?? record.rawAmount) ?? "";
    return `${primary}:${timestamp}:${amount}`;
  });

  return `${records.length}:${sample.join("|")}`;
}

function transformHistoryRecords(records: WalletHistoryRecord[]): ExplorerOperation[] {
  if (!records.length) {
    return [];
  }

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
        resolveDate(
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
    let operationReceive: Record<string, any> | undefined =
      operationReceiveSource ? { ...operationReceiveSource } : undefined;
    let operationForward: Record<string, any> | undefined =
      operationForwardSource ? { ...operationForwardSource } : undefined;

    operationSend = applyFallbacks(operationSend);
    operationReceive = applyFallbacks(operationReceive);
    operationForward = applyFallbacks(operationForward);
    applyFallbacks(operation);

    const key = `${blockHash}:${normalizedType}:${
      fallbackFrom ?? ""
    }:${fallbackTo ?? ""}:${fallbackAmount ?? ""}`;

    if (seenKeys.has(key)) {
      return;
    }
    seenKeys.add(key);

    const parsed = parseExplorerOperation({
      ...op,
      block,
      type: normalizedType,
      operation,
      operationSend,
      operationReceive,
      operationForward,
    });

    if (parsed) {
      collected.push(parsed);
    }
  };

  for (const record of records) {
    tryAdd(record, record);

    if (Array.isArray(record.operations)) {
      for (const operation of record.operations) {
        tryAdd(operation, record);
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
          tryAdd(operation, record);
        }
      }

      if (Array.isArray(staple.blocks)) {
        for (const block of staple.blocks) {
          if (!block || typeof block !== "object") {
            continue;
          }
          const blockRecord = {
            ...record,
            block: coerceString((block as Record<string, any>).hash) ?? record.block,
            operations: Array.isArray(block.operations)
              ? (block.operations as unknown[])
              : [],
          } satisfies WalletHistoryRecord;

          if (Array.isArray(blockRecord.operations)) {
            for (const operation of blockRecord.operations) {
              tryAdd(operation, blockRecord);
            }
          }
        }
      }
    }
  }

  return collected;
}

export default function ExplorerRecentActivityCard(): React.JSX.Element {
  const { publicKey } = useWallet();
  const [operations, setOperations] = useState<ExplorerOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const acct = typeof publicKey === 'string' ? publicKey : '';
        if (!acct) {
          setOperations([]);
          setError(FALLBACK_MESSAGE);
          return;
        }
        const ops = await getHistoryForAccount(acct, { depth: HISTORY_DEPTH, includeTokenMetadata: true });

        if (cancelled) {
          return;
        }

        if (!Array.isArray(ops) || ops.length === 0) {
          setOperations([]);
          setError(FALLBACK_MESSAGE);
          return;
        }

        const records: WalletHistoryRecord[] = [{ operations: ops } as unknown as WalletHistoryRecord];
        const cacheKey = `${acct}:${HISTORY_DEPTH}`;
        const fingerprint = fingerprintHistory(records);
        const cached = processedHistoryCache.get(cacheKey);
        if (cached && cached.fingerprint === fingerprint) {
          setOperations(cached.operations);
          setError(null);
          return;
        }

        const transformed = transformHistoryRecords(records);
        processedHistoryCache.set(cacheKey, {
          fingerprint,
          operations: transformed,
        });
        setOperations(transformed);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          console.error("[EXPLORER] Failed to load network stats", err);
          setOperations([]);
          setError(FALLBACK_MESSAGE);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [publicKey]);

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
