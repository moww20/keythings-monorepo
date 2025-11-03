import React from "react";

import ExplorerQuickSearch from "./components/ExplorerQuickSearch";
import ExplorerNetworkStats from "./components/ExplorerNetworkStats";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HydrationBoundary } from "@tanstack/react-query";

import { createServerQueryClient, dehydrate } from "@/lib/react-query/server";
import { explorerNetworkStatsQueryKey } from "@/lib/react-query/keys";
import { fetchNetworkStats } from "@/lib/explorer/client-reads-ssr";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExplorerHome(): Promise<React.JSX.Element> {
  const queryClient = createServerQueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: explorerNetworkStatsQueryKey,
      queryFn: () => fetchNetworkStats(),
    });
  } catch (error) {
    console.error("[EXPLORER] Failed to prefetch network stats", error);
  }

  const dehydratedState = dehydrate(queryClient);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col gap-6">
          <Card
            data-slot="card"
            className="border border-hairline bg-gradient-to-t from-primary/5 to-card shadow-[0_18px_50px_rgba(5,6,11,0.45)] @container/card"
          >
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg font-semibold text-foreground">Quick Search</CardTitle>
              <CardDescription className="text-sm text-muted">
                Look up blocks, transactions, accounts, storage identifiers, or tokens.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExplorerQuickSearch />
            </CardContent>
          </Card>
          <HydrationBoundary state={dehydratedState}>
            <ExplorerNetworkStats />
          </HydrationBoundary>
        </div>
      </div>
    </div>
  );
}
