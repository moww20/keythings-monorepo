import React from "react";

import TokensQuickSearch from "./components/TokensQuickSearch";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TokensPage(): Promise<React.JSX.Element> {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.3em] text-muted">Keythings Token Sniffer</p>
            <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
              Token Sniffer
            </h1>
            <p className="max-w-2xl text-base text-subtle">
              Discover and analyze tokens on the Keeta Network with comprehensive token information and metadata.
            </p>
          </div>

          <section className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
            <div className="mb-4 space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Token Search</h2>
              <p className="text-sm text-muted">
                Look up tokens by address, symbol, or metadata to view detailed information and analytics.
              </p>
            </div>
            <TokensQuickSearch />
          </section>
        </div>
      </div>
    </div>
  );
}
