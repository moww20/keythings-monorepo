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
  date?: string;
  account?: string;
  voteStaple?: {
    hash?: string;
    blocks?: Array<{
      hash?: string;
      $hash?: string;
      date?: string;
      createdAt?: string;
      account?: string;
      operations?: unknown[];
    }>;
    operations?: unknown[];
  };
  operations?: unknown[];
};

const FALLBACK_MESSAGE =
  "Connect your Keeta wallet to pull recent on-chain activity in real time.";

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

        const tryAdd = (candidate: unknown, record: WalletHistoryRecord) => {
          if (!candidate || typeof candidate !== "object") {
            return;
          }

          const op = candidate as Record<string, unknown>;
          const typeRaw = op.type;
          const blockHash =
            record.block ??
            record.hash ??
            record.id ??
            (typeof op.block === "string" ? (op.block as string) : null);

          if (!blockHash || typeof blockHash !== "string") {
            return;
          }

          const block = {
            $hash: blockHash,
            date:
              op.date ??
              record.date ??
              record.createdAt ??
              new Date().toISOString(),
            account:
              typeof record.account === "string" ? record.account : undefined,
          };

          const operationPayload = {
            type:
              typeof typeRaw === "string"
                ? typeRaw.toUpperCase()
                : "UNKNOWN",
            voteStapleHash:
              typeof record.voteStaple?.hash === "string"
                ? record.voteStaple.hash
                : blockHash,
            block,
            operation: op,
            operationSend: op.operationSend ?? op.send,
            operationReceive: op.operationReceive ?? op.receive,
            operationForward: op.operationForward ?? op.forward,
          };

          const parsed = parseExplorerOperation(operationPayload);
          if (parsed) {
            collected.push(parsed);
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

