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
});
