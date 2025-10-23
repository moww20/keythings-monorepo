import React from "react";

import ExplorerQuickSearch from "./components/ExplorerQuickSearch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExplorerHome(): Promise<React.JSX.Element> {

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
        </div>
      </div>
    </div>
  );
}
