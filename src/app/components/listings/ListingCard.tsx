'use client';

import Link from 'next/link';
import { type Listing } from '@/app/types/listing';

export function ListingCard({ item }: { item: Listing }): React.JSX.Element {
  return (
    <div className="glass rounded-lg border border-hairline p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-surface-strong" />
          <div>
            <div className="text-sm font-semibold text-foreground">{item.symbol}</div>
            <div className="text-xs text-muted">{item.name}</div>
          </div>
        </div>
        <Link href={`/trade/token/${encodeURIComponent(item.address)}`} className="rounded-md bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-surface-strong">View</Link>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-muted">Last Price</div>
          <div className="font-semibold text-foreground">—</div>
        </div>
        <div>
          <div className="text-muted">24h Change</div>
          <div className="font-semibold text-muted">—</div>
        </div>
        <div>
          <div className="text-muted">24h Volume</div>
          <div className="font-semibold text-muted">—</div>
        </div>
      </div>
    </div>
  );
}












