'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TradingViewChart, type TradingViewTimeframe } from '@/app/components/TradingViewChart';

const TIMEFRAME_OPTIONS: TradingViewTimeframe[] = ['1H', '4H', '1D', '1W'];

export default function TokenDetailPage(): React.JSX.Element {
  const params = useParams<{ address: string }>();
  const address = typeof params?.address === 'string' ? params.address : Array.isArray(params?.address) ? params?.address?.[0] : '';
  const [timeframe, setTimeframe] = useState<TradingViewTimeframe>('1D');

  const chartPair = useMemo(() => {
    // For now we always chart KTA/USDT. Future iterations can look up pairs dynamically from listings metadata.
    return 'KTA/USDT';
  }, []);

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
                      <h1 className="text-xl font-semibold text-foreground">Token Detail</h1>
                      <p className="text-xs text-muted">Address: <span className="font-mono">{address}</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href="/trade" className="rounded-md bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-strong transition-colors">Back to Listings</Link>
                      <button type="button" className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors">Open RFQ</button>
                      <button type="button" className="rounded-md bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-strong transition-colors">Create RFQ</button>
                    </div>
                  </div>
                </section>

                <div className="mx-auto w-full max-w-[1440px]">
                  <div className="grid grid-cols-12 gap-6">
                    <section className="col-span-12 lg:col-span-8">
                      <div className="glass rounded-lg border border-hairline p-4 md:p-6">
                        <div className="mb-4 flex flex-wrap items-center gap-2">
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
                        <div className="h-[360px]">
                          <TradingViewChart pair={chartPair} timeframe={timeframe} className="h-full w-full" />
                        </div>
                      </div>
                    </section>
                    <aside className="col-span-12 lg:col-span-4 flex flex-col gap-4">
                      <div className="glass rounded-lg border border-hairline p-4 md:p-6">
                        <div className="text-sm text-muted">RFQ actions (Open RFQ / Create RFQ) will appear here.</div>
                      </div>
                    </aside>
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


