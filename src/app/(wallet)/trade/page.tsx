'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { Listing } from '@/app/types/listing';
import { ListingFilters } from '@/app/components/listings/ListingFilters';
import { ListingTable } from '@/app/components/listings/ListingTable';
import { TradingViewChart, type TradingViewTimeframe } from '@/app/components/TradingViewChart';

const TIMEFRAME_OPTIONS: TradingViewTimeframe[] = ['1H', '4H', '1D', '1W'];

export default function TradePage(): React.JSX.Element {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('recent');
  const [timeframe, setTimeframe] = useState<TradingViewTimeframe>('1D');

  const chartPair = useMemo(() => 'KTA/USDT', []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/listings', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Failed to load listings');
        }
        const json = await res.json();
        const next = Array.isArray(json?.listings) ? (json.listings as Listing[]) : [];
        if (!cancelled) setListings(next);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load listings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = listings
    .filter((l) => {
      if (status !== 'all' && l.status !== status) return false;
      if (!query) return true;
      return (
        l.symbol.toLowerCase().includes(query.toLowerCase()) ||
        l.address.toLowerCase().includes(query.toLowerCase())
      );
    })
    .sort((a, b) => {
      if (sort === 'recent') {
        return (new Date(b.createdAt ?? 0).getTime()) - (new Date(a.createdAt ?? 0).getTime());
      }
      return 0;
    });

  return (
    <div className="h-screen bg-background">
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <div className="flex flex-1 flex-col h-full">
            <div className="@container/main flex flex-1 flex-col gap-2 overflow-auto">
              <div className="flex flex-col gap-6 py-6 md:gap-8 md:py-8">
                <section className="relative z-30 glass rounded-lg border border-hairline p-4 md:p-6 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h1 className="text-lg font-semibold text-foreground">KTA‑Denominated Listings</h1>
                      <p className="text-xs text-muted">All prices quoted in KTA. List new tokens permissionlessly.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href="/listings/new" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">List a Token</Link>
                    </div>
                  </div>
                </section>

                <section className="glass rounded-lg border border-hairline p-4 md:p-6">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {TIMEFRAME_OPTIONS.map((option) => {
                        const isActive = option === timeframe;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setTimeframe(option)}
                            className={
                              `rounded px-3 py-1 text-xs font-medium transition-colors ${
                                isActive
                                  ? 'bg-accent text-white shadow-[0_20px_50px_rgba(15,15,20,0.35)]'
                                  : 'text-muted hover:bg-surface hover:text-foreground'
                              }`
                            }
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                    <div className="min-h-[400px] rounded-lg border border-hairline bg-surface p-2 overflow-hidden">
                      <TradingViewChart pair={chartPair} timeframe={timeframe} className="h-full w-full" />
                    </div>
                  </div>
                </section>

                <div className="mx-auto w-full max-w-[1440px] space-y-6">
                  <ListingFilters
                    onSearch={(v) => setQuery(v)}
                    onStatusChange={(v) => setStatus(v)}
                    onSortChange={(v) => setSort(v)}
                  />

                  {error ? (
                    <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
                  ) : null}

                  <div className="glass rounded-lg border border-hairline p-4 md:p-6">
                    {loading ? (
                      <div className="text-sm text-muted">Loading listings…</div>
                    ) : (
                      <ListingTable listings={filtered} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
