# History Page Performance Findings

## Root Causes of Slowness

1. **Serial staple filtering delays responses.** Each history page sequentially awaits `filterStapleOperations` / `filterStapleOps`, so one slow staple blocks the entire batch and defers the first render.
2. **Normalization reprocesses the entire dataset on every update.** `normalizeHistoryRecords` rebuilds all operations whenever flattened records, wallet key, or token metadata change, performing deep cloning, BigInt math, metadata merges, fee filtering, and deduplication on the main thread.
3. **Block grouping repeats heavy aggregation work.** `groupOperationsByBlock` traverses every normalized operation to bucket by block, recompute token totals, and sort by timestamp, re-running whenever `normalized.operations` mutates (including after metadata hydration).
4. **Large, repeatedly flattened payloads amplify CPU time.** Fetching `depth: 50` pages with full operations and token metadata creates sizeable payloads that the client flattens and re-normalizes on every query update, increasing both network and processing time.

## Optimization Opportunities (Actual Speed)

1. **Parallelize or offload staple filtering.** Collect staple-filter promises with `Promise.all` or move the filtering server-side/into the bridge so one slow staple no longer stalls the whole page.
2. **Cache incremental normalization or shift it off the main thread.** Normalize each page once, reuse cached results keyed by record/block IDs, or move the pipeline into a web worker so metadata updates no longer force full recomputation.
3. **Memoize block aggregation by block hash.** Persist grouped results per block or compute them during the normalization step to avoid re-summarizing and resorting all operations on every render.
4. **Trim and stage API payloads.** Request smaller initial depths, defer `includeOperations`/metadata until needed, or prefilter records server-side to reduce client-side deserialization and flattening work.
5. **Avoid redundant array rebuilding.** Append new pages into a stable ref/structure instead of rebuilding `allRecords`, ensuring downstream normalization touches only deltas.

## Perceived Speed Improvements

1. **Show progressive feedback while heavy work continues.** Render lightweight loading shimmers, banners, or summaries immediately so the UI responds before normalization finishes.
2. **Virtualize or lazily render the history table.** Window the list (or progressively reveal rows) to keep rendering responsive even while background processing occurs.
3. **Preload the next page proactively.** Trigger `fetchNextPage` as the user nears the end of the current list or optimistically add placeholder rows to mask network latency.
4. **Stream initial results sooner.** Deliver a smaller first page for instant feedback, then hydrate additional rows and metadata asynchronously.
5. **Keep previous data visible during refetches.** Use React Query `placeholderData` / `keepPreviousData` so returning to History shows cached rows immediately while fresh data loads.

These steps address both the primary CPU/network bottlenecks and the perceived responsiveness issues on the History page.
