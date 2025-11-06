import React from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface TokenSymbolPageProps {
  params: {
    symbol: string;
  };
}

export default async function TokenSymbolPage({ params }: TokenSymbolPageProps): Promise<React.JSX.Element> {
  const { symbol } = params;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.3em] text-muted">Token Symbol Search</p>
            <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
              Token Search Results
            </h1>
            <p className="max-w-2xl text-base text-subtle">
              Search results for token symbol: <span className="font-mono text-accent">{symbol}</span>
            </p>
          </div>

          <section className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
            <div className="mb-4 space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Search Results</h2>
              <p className="text-sm text-muted">
                Searching for tokens matching symbol "{symbol}"...
              </p>
            </div>
            <div className="rounded-xl border border-soft bg-[color:color-mix(in_oklab,var(--foreground)_4%,transparent)] p-6 text-sm text-muted">
              Token search results will be displayed here once the backend integration is complete.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}




















