import { describe, expect, it } from "bun:test";

import { groupOperationsByBlock, normalizeHistoryRecords, type CachedTokenMeta } from "./provider-history";

describe("normalizeHistoryRecords", () => {
  it("collects operations and tokens that require metadata", () => {
    const account = "acct-test";
    const timestamp = new Date().toISOString();
    const records = [
      {
        block: "block-1",
        operations: [
          {
            type: "SEND",
            block: { $hash: "block-1", date: timestamp, account },
            amount: "1000",
            rawAmount: "1000",
            token: "token-1",
            from: account,
            to: "dest-1",
          },
        ],
      },
    ];

    const result = normalizeHistoryRecords(records as any[], account, {});

    expect(result.operations.length).toBe(1);
    expect(result.operations[0].type).toBe("SEND");
    expect(result.tokensToFetch).toContain("token-1");
  });

  it("formats token amounts accurately for high-precision decimals", () => {
    const account = "acct-precise";
    const timestamp = new Date().toISOString();
    const tokenId = "token-24";
    const records = [
      {
        block: "block-precise",
        operations: [
          {
            type: "SEND",
            block: { $hash: "block-precise", date: timestamp, account },
            amount: "1000000000000000000000000",
            rawAmount: "1000000000000000000000000",
            token: tokenId,
            tokenTicker: "TK24",
            tokenDecimals: 24,
            from: account,
            to: "dest-precise",
          },
        ],
      },
    ];

    const metadata: Record<string, CachedTokenMeta> = {
      [tokenId]: {
        ticker: "TK24",
        decimals: 24,
        fieldType: "decimals",
      },
    };

    const result = normalizeHistoryRecords(records as any[], account, metadata);

    expect(result.operations.length).toBe(1);
    expect(result.operations[0].formattedAmount).toBe("1 TK24");
  });
});

describe("groupOperationsByBlock", () => {
  it("aggregates multiple operations from the same block into a single summary", () => {
    const account = "acct-aggregate";
    const timestamp = new Date().toISOString();
    const tokenId = "token-aggregate";
    const metadata: Record<string, CachedTokenMeta> = {
      [tokenId]: {
        ticker: "TOK",
        decimals: 6,
        fieldType: "decimals",
      },
    };

    const records = [
      {
        block: "block-agg",
        operations: [
          {
            type: "SEND",
            block: { $hash: "block-agg", date: timestamp, account },
            amount: "1000000",
            rawAmount: "1000000",
            token: tokenId,
            tokenTicker: "TOK",
            tokenDecimals: 6,
            from: account,
            to: "dest-agg",
          },
          {
            type: "RECEIVE",
            block: { $hash: "block-agg", date: timestamp, account },
            amount: "250000",
            rawAmount: "250000",
            token: tokenId,
            tokenTicker: "TOK",
            tokenDecimals: 6,
            from: "src-agg",
            to: account,
          },
        ],
      },
    ];

    const normalized = normalizeHistoryRecords(records as any[], account, metadata);
    expect(normalized.operations.length).toBe(2);

    const grouped = groupOperationsByBlock(normalized.operations);
    expect(grouped.length).toBe(1);

    const summary = grouped[0] as any;
    expect(summary.type).toBe("SEND");
    expect(summary.from).toBe(account);
    expect(summary.to).toBe("dest-agg");
    expect(summary.formattedAmount).toBe("0.75 TOK");
  });

  it("combines multiple tokens in the same blockhash", () => {
    const account = "acct-multi-token";
    const timestamp = new Date().toISOString();
    const tokenA = "token-a";
    const tokenB = "token-b";
    const blockHash = "block-multi";
    const metadata: Record<string, CachedTokenMeta> = {
      [tokenA]: {
        ticker: "KTA",
        decimals: 9,
        fieldType: "decimalPlaces",
      },
      [tokenB]: {
        ticker: "USDC",
        decimals: 6,
        fieldType: "decimals",
      },
    };

    const operations = [
      {
        type: "SEND",
        block: { $hash: blockHash, date: timestamp, account },
        rawAmount: "1000000000",
        amount: "1000000000",
        token: tokenA,
        tokenTicker: "KTA",
        tokenDecimals: 9,
        tokenMetadata: metadata[tokenA],
        from: account,
        to: "dest-1",
        blockTimestamp: Date.now(),
        rowId: `${blockHash}:1`,
      },
      {
        type: "RECEIVE",
        block: { $hash: blockHash, date: timestamp, account },
        rawAmount: "5000000",
        amount: "5000000",
        token: tokenB,
        tokenTicker: "USDC",
        tokenDecimals: 6,
        tokenMetadata: metadata[tokenB],
        from: "src-1",
        to: account,
        blockTimestamp: Date.now() + 1000,
        rowId: `${blockHash}:2`,
      },
    ];

    const grouped = groupOperationsByBlock(operations as any);
    expect(grouped.length).toBe(1);

    const summary = grouped[0] as any;
    expect(summary.formattedAmount).toContain("1 KTA");
    expect(summary.formattedAmount).toContain("5 USDC");
    expect(summary.formattedAmount).toMatch(/1 KTA \+ 5 USDC|5 USDC \+ 1 KTA/);
  });

  it("preserves blockTimestamp for sorting", () => {
    const account = "acct-timestamp";
    const timestamp = new Date().toISOString();
    const blockHash = "block-ts";
    const baseTimestamp = 1000000000;

    const operations = [
      {
        type: "SEND",
        block: { $hash: blockHash, date: timestamp, account },
        rawAmount: "1000000",
        amount: "1000000",
        token: "token-1",
        tokenTicker: "TOK",
        tokenDecimals: 6,
        from: account,
        to: "dest-1",
        blockTimestamp: baseTimestamp,
        rowId: `${blockHash}:1`,
      },
      {
        type: "RECEIVE",
        block: { $hash: blockHash, date: timestamp, account },
        rawAmount: "500000",
        amount: "500000",
        token: "token-1",
        tokenTicker: "TOK",
        tokenDecimals: 6,
        from: "src-1",
        to: account,
        blockTimestamp: baseTimestamp + 2000, // Later timestamp
        rowId: `${blockHash}:2`,
      },
    ];

    const grouped = groupOperationsByBlock(operations as any);
    expect(grouped.length).toBe(1);

    const summary = grouped[0] as any;
    // Should preserve the latest timestamp
    expect(summary.blockTimestamp).toBe(baseTimestamp + 2000);
  });

  it("preserves rowId for React keys", () => {
    const account = "acct-rowid";
    const timestamp = new Date().toISOString();
    const blockHash = "block-rowid";

    const operations = [
      {
        type: "SEND",
        block: { $hash: blockHash, date: timestamp, account },
        rawAmount: "1000000",
        amount: "1000000",
        token: "token-1",
        tokenTicker: "TOK",
        tokenDecimals: 6,
        from: account,
        to: "dest-1",
        rowId: `${blockHash}:1`,
      },
      {
        type: "RECEIVE",
        block: { $hash: blockHash, date: timestamp, account },
        rawAmount: "500000",
        amount: "500000",
        token: "token-1",
        tokenTicker: "TOK",
        tokenDecimals: 6,
        from: "src-1",
        to: account,
        rowId: `${blockHash}:2`,
      },
    ];

    const grouped = groupOperationsByBlock(operations as any);
    expect(grouped.length).toBe(1);

    const summary = grouped[0] as any;
    // Should preserve the first rowId
    expect(summary.rowId).toBe(`${blockHash}:1`);
  });

  it("handles operations with zero net amount", () => {
    const account = "acct-zero";
    const timestamp = new Date().toISOString();
    const blockHash = "block-zero";

    const operations = [
      {
        type: "SEND",
        block: { $hash: blockHash, date: timestamp, account },
        rawAmount: "1000000",
        amount: "1000000",
        token: "token-1",
        tokenTicker: "TOK",
        tokenDecimals: 6,
        from: account,
        to: "dest-1",
      },
      {
        type: "RECEIVE",
        block: { $hash: blockHash, date: timestamp, account },
        rawAmount: "1000000",
        amount: "1000000",
        token: "token-1",
        tokenTicker: "TOK",
        tokenDecimals: 6,
        from: "src-1",
        to: account,
      },
    ];

    const grouped = groupOperationsByBlock(operations as any);
    expect(grouped.length).toBe(1);

    const summary = grouped[0] as any;
    // Net amount is zero, should keep original type or default to Transaction
    expect(summary.type).toBe("Transaction");
    expect(summary.formattedAmount).toBe("0 TOK");
  });

  it("does not group operations with different blockhashes", () => {
    const account = "acct-different";
    const timestamp = new Date().toISOString();

    const operations = [
      {
        type: "SEND",
        block: { $hash: "block-1", date: timestamp, account },
        rawAmount: "1000000",
        amount: "1000000",
        token: "token-1",
        tokenTicker: "TOK",
        tokenDecimals: 6,
        from: account,
        to: "dest-1",
      },
      {
        type: "RECEIVE",
        block: { $hash: "block-2", date: timestamp, account },
        rawAmount: "500000",
        amount: "500000",
        token: "token-1",
        tokenTicker: "TOK",
        tokenDecimals: 6,
        from: "src-1",
        to: account,
      },
    ];

    const grouped = groupOperationsByBlock(operations as any);
    expect(grouped.length).toBe(2);
    // Operations are sorted by timestamp descending, then blockhash
    const hashes = grouped.map((op) => op.block.$hash);
    expect(hashes).toContain("block-1");
    expect(hashes).toContain("block-2");
  });

  it("handles operations without blockhash (orphans)", () => {
    const account = "acct-orphan";
    const timestamp = new Date().toISOString();

    const operations = [
      {
        type: "SEND",
        block: { $hash: "block-1", date: timestamp, account },
        rawAmount: "1000000",
        amount: "1000000",
        token: "token-1",
        tokenTicker: "TOK",
        tokenDecimals: 6,
        from: account,
        to: "dest-1",
      },
      {
        type: "RECEIVE",
        block: null as any,
        rawAmount: "500000",
        amount: "500000",
        token: "token-1",
        tokenTicker: "TOK",
        tokenDecimals: 6,
        from: "src-1",
        to: account,
      },
    ];

    const grouped = groupOperationsByBlock(operations as any);
    expect(grouped.length).toBe(2);
    // One operation has blockhash, one is orphan
    const hasBlockHash = grouped.find((op) => op.block?.$hash === "block-1");
    const isOrphan = grouped.find((op) => !op.block || !op.block.$hash);
    expect(hasBlockHash).toBeDefined();
    expect(isOrphan).toBeDefined();
  });

  it("aggregates multiple operations with the same token in the same block", () => {
    const account = "acct-same-token";
    const timestamp = new Date().toISOString();
    const blockHash = "block-same-token";
    const tokenId = "token-same";

    const operations = [
      {
        type: "SEND",
        block: { $hash: blockHash, date: timestamp, account },
        rawAmount: "1000000000", // 1 KTA (9 decimals)
        amount: "1000000000",
        token: tokenId,
        tokenAddress: tokenId,
        tokenTicker: "KTA",
        tokenDecimals: 9,
        tokenLookupId: tokenId,
        from: account,
        to: "dest-1",
        blockTimestamp: Date.now(),
        rowId: `${blockHash}:1`,
      },
      {
        type: "SEND",
        block: { $hash: blockHash, date: timestamp, account },
        rawAmount: "500000000", // 0.5 KTA
        amount: "500000000",
        token: tokenId,
        tokenAddress: tokenId,
        tokenTicker: "KTA",
        tokenDecimals: 9,
        tokenLookupId: tokenId,
        from: account,
        to: "dest-2",
        blockTimestamp: Date.now() + 100,
        rowId: `${blockHash}:2`,
      },
    ];

    const grouped = groupOperationsByBlock(operations as any);
    expect(grouped.length).toBe(1);

    const summary = grouped[0] as any;
    // Should aggregate: 1 KTA + 0.5 KTA = 1.5 KTA total sent
    expect(summary.formattedAmount).toBe("1.5 KTA");
    expect(summary.type).toBe("SEND");
  });

  it("handles sorting with orphan operations (null block)", () => {
    const account = "acct-orphan-sort";
    const timestamp = new Date().toISOString();

    const operations = [
      {
        type: "SEND",
        block: { $hash: "block-1", date: timestamp, account },
        rawAmount: "1000000",
        amount: "1000000",
        token: "token-1",
        tokenTicker: "TOK",
        tokenDecimals: 6,
        from: account,
        to: "dest-1",
        blockTimestamp: Date.now(),
      },
      {
        type: "RECEIVE",
        block: null as any,
        rawAmount: "500000",
        amount: "500000",
        token: "token-1",
        tokenTicker: "TOK",
        tokenDecimals: 6,
        from: "src-1",
        to: account,
        blockTimestamp: Date.now() + 1000,
      },
      {
        type: "SEND",
        block: { $hash: "block-2", date: timestamp, account },
        rawAmount: "2000000",
        amount: "2000000",
        token: "token-1",
        tokenTicker: "TOK",
        tokenDecimals: 6,
        from: account,
        to: "dest-2",
        blockTimestamp: Date.now() + 2000,
      },
    ];

    // Should not throw when sorting operations with null blocks
    const grouped = groupOperationsByBlock(operations as any);
    expect(grouped.length).toBe(3);
    
    // Verify sorting works (should sort by timestamp descending)
    const timestamps = grouped.map((op) => (op as any).blockTimestamp).filter(Boolean);
    if (timestamps.length > 1) {
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
      }
    }
  });

  it("validates operations with Zod schema before grouping", () => {
    const invalidOperations = [
      {
        // Missing required 'type' field - should fail
        block: { $hash: "block-1" },
      },
      {
        type: "SEND",
        // Missing block.$hash - should fail (not an orphan since block exists but has no $hash)
        block: {},
      },
    ];

    const grouped = groupOperationsByBlock(invalidOperations as any);
    // Invalid operations should be filtered out
    expect(grouped.length).toBe(0);
  });
});
