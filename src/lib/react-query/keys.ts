export const walletQueryKey = ["wallet"] as const;
export const walletTokensQueryKey = ["wallet", "tokens"] as const;
export const explorerNetworkStatsQueryKey = ["explorer", "network-stats"] as const;
export const explorerSearchHistoryQueryKey = ["explorer", "search-history"] as const;
export const historyQueryKey = (account?: string | null) => ["history", account ?? ""] as const;
