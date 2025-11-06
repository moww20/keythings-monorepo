import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock provider history utilities
vi.mock("@/lib/history/provider-history", () => {
  return {
    fetchProviderHistory: vi.fn().mockResolvedValue({
      records: [
        // Unsorted provider operations (newest first is not guaranteed here)
        {
          type: "SEND",
          amount: "10",
          tokenTicker: "KTA",
          blockTimestamp: Date.now() - 60_000, // 1 min ago
          block: { $hash: "h2", date: new Date(Date.now() - 60_000).toISOString() },
        },
        {
          type: "RECEIVE",
          rawAmount: "5",
          tokenTicker: "KTA",
          blockTimestamp: Date.now() - 10_000, // 10s ago
          block: { $hash: "h1", date: new Date(Date.now() - 10_000).toISOString() },
        },
        {
          // This will duplicate an sdk record by hash+type+amount+ticker+timestamp
          type: "SWAP",
          amount: "3",
          tokenTicker: "KTA",
          blockTimestamp: Date.now() - 30_000, // 30s ago
          block: { $hash: "dup", date: new Date(Date.now() - 30_000).toISOString() },
        },
      ],
      hasMore: false,
      cursor: null,
    }),
    normalizeHistoryRecords: vi.fn().mockImplementation((records: any[]) => ({
      operations: records as any[],
    })),
    groupOperationsByBlock: vi.fn().mockImplementation((operations: any[]) => operations),
  };
});

// Mock SDK history
vi.mock("@/lib/explorer/sdk-read-client", () => {
  const now = Date.now();
  return {
    getHistoryForAccount: vi.fn().mockResolvedValue([
      {
        id: "sdk1",
        type: "RECEIVE",
        amount: "1",
        tokenTicker: "KTA",
        timestamp: now - 5_000, // 5s ago (should be newest)
        block: "sb1",
      },
      {
        id: "sdk2",
        type: "SWAP",
        amount: "3",
        tokenTicker: "KTA",
        timestamp: now - 30_000, // 30s ago (duplicate with provider)
        block: "dup",
      },
    ]),
  };
});

import { fetchRecentActivityItems } from "@/lib/history/recent-activity";

describe("recent-activity top 3", () => {
  beforeAll(() => {
    // Provide a mock window.keeta so provider path is enabled
    (globalThis as any).window = { keeta: {} };
  });

  it("merges, de-dupes, sorts desc and limits to 3", async () => {
    const result = await fetchRecentActivityItems("keeta_test_account", { limit: 3, forceRefresh: true });
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items.length).toBe(3);

    // Ensure sorted desc by timestampMs
    const ts = result.items.map((it) => it.timestampMs ?? 0);
    const sorted = [...ts].sort((a, b) => b - a);
    expect(ts).toEqual(sorted);

    // Ensure duplicate (by key) across provider and sdk was removed
    // The duplicate record has hash "dup" and amount "3" SWAP KTA at ~30s ago
    const dupKeyMatches = result.items.filter(
      (it) => (it.blockHash ?? "") === "dup" && it.type === "SWAP" && (it.amount ?? "") === "3" && (it.tokenTicker ?? "") === "KTA",
    );
    expect(dupKeyMatches.length).toBe(1);
  });
});


