'use client';

import { useState } from 'react';

export interface ListingFiltersProps {
  onSearch: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSortChange: (value: string) => void;
}

export function ListingFilters({ onSearch, onStatusChange, onSortChange }: ListingFiltersProps): React.JSX.Element {
  const [query, setQuery] = useState('');

  return (
    <div className="glass rounded-lg border border-hairline p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:max-w-md">
          <label className="text-xs text-muted">Search by symbol or address</label>
          <input
            className="input-pill border border-hairline bg-[color:var(--background)] px-3 py-2 text-sm rounded-lg"
            placeholder="e.g., XTK or keeta_..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch(query)
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Status</label>
            <select className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm" onChange={(e) => onStatusChange(e.target.value)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Sort</label>
            <select className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm" onChange={(e) => onSortChange(e.target.value)}>
              <option value="recent">Most Recent</option>
              <option value="volume">24h Volume</option>
              <option value="price">Last Price</option>
            </select>
          </div>
          <button type="button" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" onClick={() => onSearch(query)}>Search</button>
        </div>
      </div>
    </div>
  );
}









