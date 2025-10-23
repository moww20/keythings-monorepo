"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchNetworkStats } from "@/lib/explorer/client";

type NetworkStats = Awaited<ReturnType<typeof fetchNetworkStats>>;

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export default function ExplorerNetworkStats(): React.JSX.Element {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const result = await fetchNetworkStats();
        if (!cancelled) {
          setStats(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[EXPLORER] Failed to load network stats", err);
          setStats(null);
          setError("Connect your Keeta wallet to retrieve live network metrics.");
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

  const metrics = useMemo(() => {
    if (!stats) {
      return [
        { label: "Blocks", value: "—" },
        { label: "Transactions", value: "—" },
        { label: "Representatives", value: "—" },
        { label: "Query Time", value: "—" },
      ];
    }

    return [
      { label: "Blocks", value: numberFormatter.format(stats.blockCount ?? 0) },
      { label: "Transactions", value: numberFormatter.format(stats.transactionCount ?? 0) },
      { label: "Representatives", value: numberFormatter.format(stats.representativeCount ?? 0) },
      {
        label: "Query Time",
        value: stats.queryTime ? `${stats.queryTime} ms` : "—",
      },
    ];
  }, [stats]);

  const lastUpdated = useMemo(() => {
    if (!stats?.time) {
      return null;
    }
    const date = new Date(stats.time);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toLocaleString();
  }, [stats]);

  return (
    <section>
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Network Overview</h2>
        <p className="text-sm text-muted">Live settlement metrics from the Keeta network.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card
            key={metric.label}
            className="glass border border-hairline bg-surface shadow-[0_18px_50px_rgba(5,6,11,0.45)]"
          >
            <CardHeader className="px-6 pb-2">
              <CardTitle className="text-xs uppercase tracking-[0.3em] text-muted">
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {loading ? (
                <Skeleton className="h-8 w-24 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
              ) : (
                <p className="text-2xl font-semibold text-foreground">{metric.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-subtle">
        <span>{error ?? "Metrics ready for review."}</span>
        {lastUpdated ? <span>Last updated {lastUpdated}</span> : null}
      </div>
    </section>
  );
}

