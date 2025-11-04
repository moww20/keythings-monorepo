'use client';

import { useRouter } from 'next/navigation';
import { type Listing } from '@/app/types/listing';
import { TokenIcon } from './TokenIcon';

export interface ListingTableProps {
  listings: Listing[];
}

export function ListingTable({ listings }: ListingTableProps): React.JSX.Element {
  const router = useRouter();

  if (!listings || listings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-hairline bg-surface p-6 text-center text-sm text-muted">
        No listings yet. Be the first to list a token.
      </div>
    );
  }

  const handleRowClick = (address: string) => {
    router.push(`/trade/token/${encodeURIComponent(address)}`);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-hairline">
      <table className="w-full">
        <thead>
          <tr className="border-b border-hairline">
            <th className="py-3 px-4 text-left text-xs font-medium text-muted">Token</th>
            <th className="py-3 px-4 text-left text-xs font-medium text-muted">Address</th>
            <th className="py-3 px-4 text-right text-xs font-medium text-muted">Last Price (KTA)</th>
            <th className="py-3 px-4 text-right text-xs font-medium text-muted">24h Change</th>
            <th className="py-3 px-4 text-right text-xs font-medium text-muted">24h Volume</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((item) => (
            <tr
              key={item.address}
              onClick={() => handleRowClick(item.address)}
              className="border-b border-hairline cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted/70"
            >
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <TokenIcon address={item.address} symbol={item.symbol} size={24} />
                  <div>
                    <div className="text-sm font-semibold text-foreground">{item.symbol}</div>
                    <div className="text-xs text-muted">{item.name}</div>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4">
                <span className="font-mono text-xs text-accent">
                  {item.address.slice(0, 8)}…{item.address.slice(-6)}
                </span>
              </td>
              <td className="py-3 px-4 text-right text-sm text-foreground">—</td>
              <td className="py-3 px-4 text-right text-sm text-muted">—</td>
              <td className="py-3 px-4 text-right text-sm text-muted">—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}



