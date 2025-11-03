"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchNetworkStats } from "@/lib/explorer/client";
import { explorerNetworkStatsQueryKey } from "@/lib/react-query/keys";

type NetworkStats = Awaited<ReturnType<typeof fetchNetworkStats>>;

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const REFRESH_INTERVAL_MS = 60_000;

export default function ExplorerNetworkStats(): React.JSX.Element {
  const { data, error, isPending, isFetching } = useQuery({
    queryKey: explorerNetworkStatsQueryKey,
    queryFn: () => fetchNetworkStats({ forceRefresh: true }),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const stats = data ?? null;

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

  const showSkeleton = !stats && isPending;
  const statusMessage = (() => {
    if (error) {
      return "Connect your Keeta wallet to retrieve live network metrics.";
    }
    if (isFetching) {
      return "Refreshing metrics...";
    }
    return "Metrics ready for review.";
  })();

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
              {showSkeleton ? (
                <Skeleton className="h-8 w-24 rounded-md bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />
              ) : (
                <p className="text-2xl font-semibold text-foreground">{metric.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-subtle">
        <span>{statusMessage}</span>
        {lastUpdated ? <span>Last updated {lastUpdated}</span> : null}
      </div>
    </section>
  );
}

