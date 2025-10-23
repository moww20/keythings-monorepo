'use client';

import { useMemo } from 'react';

import { useRFQContext } from '@/app/contexts/RFQContext';
import type { OrderSide } from '@/app/types/rfq';

interface DepthRow {
  price: number;
  size: number;
  cumulative: number;
  side: OrderSide;
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: value < 1 ? 6 : 2 });
}

export function RFQDepthChart(): React.JSX.Element {
  const { buckets } = useRFQContext();

  const rows = useMemo<DepthRow[]>(() => {
    const openOrders = buckets.open;
    const grouped: Record<string, DepthRow> = {};

    for (const order of openOrders) {
      const key = `${order.side}-${order.price.toFixed(2)}`;
      if (!grouped[key]) {
        grouped[key] = {
          price: order.price,
          size: 0,
          cumulative: 0,
          side: order.side,
        };
      }
      grouped[key]!.size += order.size;
    }

    const groupedRows = Object.values(grouped).sort((left, right) => left.price - right.price);

    return groupedRows.reduce((acc, row) => {
      const lastSell = acc.filter(r => r.side === 'sell').pop()?.cumulative || 0;
      const lastBuy = acc.filter(r => r.side === 'buy').pop()?.cumulative || 0;
      
      if (row.side === 'sell') {
        const cumulative = lastSell + row.size;
        acc.push({ ...row, cumulative });
      } else {
        const cumulative = lastBuy + row.size;
        acc.push({ ...row, cumulative });
      }
      
      return acc;
    }, [] as Array<typeof groupedRows[0] & { cumulative: number }>);
  }, [buckets.open]);

  const maxCumulative = useMemo(() => Math.max(...rows.map((row) => row.cumulative), 1), [rows]);

  return (
    <div className="rounded-lg border border-hairline bg-surface p-4">
      <h2 className="text-lg font-semibold text-foreground">Depth Snapshot</h2>
      <p className="text-xs text-muted">Aggregated RFQ size by price level.</p>
      <div className="mt-4 space-y-2 text-xs text-muted">
        {rows.length === 0 && <p className="text-center text-xs text-muted">No open RFQs available.</p>}
        {rows.map((row) => {
          const width = Math.max((row.cumulative / maxCumulative) * 100, 5);
          const isSell = row.side === 'sell';
          return (
            <div key={`${row.side}-${row.price}`} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-foreground">${formatNumber(row.price)}</span>
                <span>{formatNumber(row.size)} base</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-strong">
                <div
                  className={` h-full`}
                  style={{ width: `${width}%` }}
                  aria-hidden="true"
                />
              </div>
              <div className="text-[10px] text-muted">Cumulative {formatNumber(row.cumulative)} base</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RFQDepthChart;

