# cacheComponents Opportunities

This document consolidates caching candidates across the Keythings app so teams can prioritize cacheComponents integration and related memoization work.

## RFQ Workflows
- **Context refresh loops** (`src/app/contexts/RFQContext.tsx`): `fetchRfqOrders` and `fetchRfqMakers` refire on every pair change and even refetch the global order book on empty pairs. `fetchRfqAvailablePairs` is also fetched independently. Wrapping these helpers or the context provider itself in `cache()`-backed services would prevent triplicate network calls during a single navigation.
- **Orders panel declarations** (`src/app/components/rfq/RFQOrdersPanel.tsx`): the panel refetches `fetchDeclarations(order.id)` for each maker whenever the view toggles. Memoizing declarations per order (or caching the entire panel) would eliminate redundant downloads while switching maker/taker tabs.
- **Taker panel metadata** (`src/app/components/rfq/RFQTakerPanel.tsx`): token metadata for maker/taker assets is reloaded every time the selected order or escrow changes. Sharing a metadata cache via cacheComponents would dedupe wallet RPC calls across RFQ panels and dashboards.
- **Trade page vs. context** (`src/app/(wallet)/trade/page.tsx` + `src/app/contexts/RFQContext.tsx`): both fetch the RFQ pair list separately. Centralizing the pair discovery helper behind cacheComponents allows all consumers to reuse the normalized pair catalogue.
- **RFQ data helpers** (`src/lib/...`): `fetchRfqAvailablePairs`, `fetchRfqOrders`, `fetchRfqMakers`, and `fetchDeclarations` currently hit the backend on every call. Introduce `cache()` wrappers (keyed by pair/order with short revalidation) to dedupe requests from server and client paths.

## Shared Market Data
- **KTA price snapshot reuse** (`src/app/dashboard/dashboard-client.tsx`, `src/app/(wallet)/trade/page.tsx`): both views call `window.keeta.getKtaPrice` and recompute USD metrics. Expose a cached provider/component so every consumer resolves a single price snapshot per polling interval.
- **RFQ pair catalogue reuse**: the trade page and RFQ context repeat the same pair discovery flow. Cache the normalized pair + symbol mapping so UI remounts reuse a single dataset.

## Explorer Views & Server Routes
- **Network statistics widget** (`src/app/explorer/components/ExplorerNetworkStats.tsx`): every mount triggers `fetchNetworkStats()` which already falls back to wallet RPCs. Cache the fetcher or component (15–30 s TTL) to reduce provider chatter.
- **Recent activity card** (`src/app/explorer/components/ExplorerRecentActivityCard.tsx`): re-computes heavy transforms over `window.keeta.history()` each render. Cache the transformation keyed by cursor depth to reuse processed operations across cards.
- **Transactions page** (`src/app/explorer/transactions/page.tsx`): each request recomputes the same result set with identical cursor/depth. Apply `cache()`/`unstable_cache()` keyed on `{cursor, depth}` so hot navigations reuse the page payload.
- **Certificate detail routes** (`src/app/explorer/account-certificates/[hash]/page.tsx`, `src/app/explorer/storage-certificates/[hash]/page.tsx`): `fetchAccountCertificate` produces deterministic objects yet re-runs each render. Cache the fetcher by `{accountPublicKey, certificateHash}` to avoid duplicate work as the live API lands.
- **Explorer REST shim + hooks** (`src/lib/api/...`, `src/app/hooks/useApi.ts`): raw `fetch` calls execute on every mount. Introduce cacheComponents or React Query keyed by public key/hash so navigation reuses payloads even under high latency.
- **Aggregated explorer data** (`src/lib/explorer/getAggregatedBalancesForOwner`, `src/lib/explorer/getHistoryForAccount`, `src/app/explorer/hooks/useExplorerData.ts`): heavy aggregation/filtering is recomputed per subscriber. Memoize helpers with `cache()` per account + depth/cursor to share results across tables, cards, and summaries.

## Wallet History & Token Metadata
- **History page metadata loop** (`src/app/history/page.tsx`): iterates through `hydrated.tokensToFetch` and calls `getTokenMeta` for each unseen token whenever the table rerenders. Cache the history component or batch metadata fetches to avoid duplicate lookups.
- **Token metadata service** (`src/lib/tokens/metadata-service.ts`): already memoized; expose the cache via cacheComponents or a shared provider so RFQ, history, and explorer views reuse the same metadata pool.
- **Explorer history consumers** (`src/app/history/page.tsx`, `src/app/explorer/components/ExplorerRecentActivityCard.tsx`, token detail view): multiple components invoke `window.keeta.history()` with similar parameters. Centralize the call behind a cached helper to dedupe large payload downloads and parsing.

## Pools & Trading APIs
- **Pools API hook** (`src/hooks/usePoolsApi.ts`): `fetchPools`/`getQuote` issue raw network calls on every usage. Add module-level caching or React Query integration keyed by `(poolId, tokenIn, amountIn)` to debounce repeated requests during configuration flows.
- **Wallet trading status** (`src/app/contexts/WalletContext.tsx` or related services): `GET /api/users/{account}/status` fires on every connection state change. Cache the status payload per account until logout/refresh to shorten the enablement loop.

## Storage Explorer & Chain Reads
- **Storage list view** (`src/components/storage-list.tsx`): despite a manual TTL cache, the component still repeats provider → user client → fresh client → backend fallbacks once TTL expires. Promote the entire view into a cached component keyed by owner to share hydrated ACL lists across tabs.
- **Storage account loader** (`src/hooks/useStorage.ts`): falls back to `fetchStorageFromChain` and rebuilds token metadata every time. Cache the normalized storage snapshot per public key (with TTL) to keep explorer storage pages snappy.
- **Explorer storage aggregation** (`getAggregatedBalancesForOwner`): the aggregation output is not cached even though metadata is. Cache the entire result by owner + options so dashboards and account views reuse totals.

## Static & Deterministic Server Components
- **Marketing home** (`src/app/page.tsx`): renders static arrays/content—ideal for cacheComponents.
- **Legacy “test wallet removed” notice** (`src/app/test-wallet/page.tsx`): static paragraph that can be cached indefinitely.
- **Dashboard shell** (`src/app/dashboard/page.tsx`): server portion composes constant layout; cache to avoid rebuilding wrapper each navigation.
- **Explorer landing** (`src/app/explorer/page.tsx`): currently force-dynamic despite static content; enable caching.
- **Tokens landing/detail stubs** (`src/app/tokens/page.tsx`, `src/app/tokens/token/[address]/page.tsx`, `src/app/tokens/symbol/[symbol]/page.tsx`): placeholder UIs with deterministic output; cache the components until dynamic data arrives.
- **Explorer transactions + certificate stubs**: normalize timestamp seeding, then cache components/pages so anonymous visitors reuse the fallback payload.
- **Helper stubs** (`fetchStorage`, `fetchToken`, `fetchTokensBatch`): these synthesize static metadata—wrap with `cache()` to avoid rebuilding identical objects.

## General Guidance
- Pair every cached fetcher with explicit invalidation (`revalidateTag`, manual `Map.delete`, or context refresh hooks) so post-mutation flows (placing RFQ orders, updating storage permissions, etc.) stay correct.
- Adopt cacheComponents boundaries around server components or shared loaders to reduce duplicate network/CPU work while keeping UI latency low.

