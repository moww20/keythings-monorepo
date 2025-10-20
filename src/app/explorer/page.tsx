import Link from "next/link";
import React from "react";

import {
  fetchNetworkStats,
  fetchTransactions,
  type ExplorerOperation,
} from "@/lib/explorer/client";

import ExplorerQuickSearch from "./components/ExplorerQuickSearch";
import { truncateIdentifier } from "./utils/resolveExplorerPath";
import {
  describeOperation,
  formatRelativeTime,
  parseExplorerDate,
} from "./utils/operation-format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MetricCard = {
  label: string;
  value: string;
  helper?: string;
};

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export default async function ExplorerHome(): Promise<React.JSX.Element> {
  const [statsResult, transactionsResult] = await Promise.allSettled([
    fetchNetworkStats(),
    fetchTransactions({ depth: 10 }),
  ]);

  const stats = statsResult.status === "fulfilled" ? statsResult.value : null;
  const transactions =
    transactionsResult.status === "fulfilled" ? transactionsResult.value : null;

  const latestOperations = transactions?.stapleOperations.slice(0, 6) ?? [];
  const latestBlockHash = latestOperations[0]?.block?.$hash ?? null;
  const latestBlockDate = parseExplorerDate(latestOperations[0]?.block?.date ?? stats?.time);

  const metrics: MetricCard[] = [
    {
      label: "Latest Block",
      value: latestBlockHash ? truncateIdentifier(latestBlockHash, 10, 8) : "—",
      helper: latestBlockHash && latestBlockDate
        ? `~ ${formatRelativeTime(latestBlockDate)}`
        : undefined,
    },
    {
      label: "Total Blocks",
      value: formatNumber(stats?.blockCount),
    },
    {
      label: "Total Transactions",
      value: formatNumber(stats?.transactionCount),
    },
    {
      label: "Representatives",
      value: formatNumber(stats?.representativeCount),
      helper: stats?.time ? `as of ${parseExplorerDate(stats.time)?.toLocaleTimeString() ?? "latest"}` : undefined,
    },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.3em] text-muted">Keythings Explorer</p>
            <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
              Network Activity Overview
            </h1>
            <p className="max-w-2xl text-base text-subtle">
              Monitor recent blocks, transactions, and account metrics across the Keeta Network with Keythings styling and live explorer data.
            </p>
          </div>

          <section className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_20px_60px_rgba(6,7,10,0.45)]">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="space-y-2">
                  <p className="text-sm text-muted">{metric.label}</p>
                  <p className="text-2xl font-semibold text-foreground">{metric.value}</p>
                  {metric.helper && (
                    <p className="text-xs text-faint">{metric.helper}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <section className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-foreground">Latest Activity</h2>
                  <p className="text-sm text-muted">Recent ledger operations from the Keeta explorer feed.</p>
                </div>
                <Link
                  href="/explorer/transactions"
                  className="text-sm font-medium text-accent transition hover:text-foreground"
                >
                  View all
                </Link>
              </div>
              {latestOperations.length === 0 ? (
                <div className="rounded-xl border border-soft bg-[color:color-mix(in_oklab,var(--foreground)_4%,transparent)] p-6 text-sm text-muted">
                  No operations available right now. Try again shortly.
                </div>
              ) : (
                <div className="space-y-3">
                  {latestOperations.map((operation) => {
                    const blockHash = operation.block.$hash;
                    const timestamp = parseExplorerDate(operation.block.date) ?? new Date();
                    const relativeTime = formatRelativeTime(timestamp) ?? "Just now";
                    const summary = describeOperation(operation);
                    return (
                      <div
                        key={`${blockHash}-${operation.voteStapleHash ?? operation.type}`}
                        className="rounded-xl border border-soft bg-[color:color-mix(in_oklab,var(--foreground)_3%,transparent)] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-col">
                            <span className="text-xs uppercase tracking-[0.3em] text-faint">{operation.type}</span>
                            <Link
                              href={`/explorer/block/${blockHash}`}
                              className="text-base font-medium text-foreground hover:text-accent"
                            >
                              {truncateIdentifier(blockHash, 12, 10)}
                            </Link>
                          </div>
                          <span className="text-sm text-muted">{relativeTime}</span>
                        </div>
                        <p className="mt-3 text-sm text-subtle">
                          {summary}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
              <div className="mb-4 space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Quick Search</h2>
                <p className="text-sm text-muted">
                  Look up blocks, transactions, accounts, storage identifiers, or tokens.
                </p>
              </div>
              <ExplorerQuickSearch />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
