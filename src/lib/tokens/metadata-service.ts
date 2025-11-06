import { z } from "zod";
import { getTokenMetadataRecord } from "@/lib/explorer/sdk-read-client";
import { parseTokenMetadata } from "@/app/explorer/utils/token-metadata";

type TokenMetadataRecord = {
  metadata?: string | null;
  decimals?: number;
  fieldType?: "decimalPlaces" | "decimals";
  name?: string;
  ticker?: string;
  metadataBase64?: string | null;
};

export type TokenMetadataEntry = {
  token: string;
  decimals: number;
  fieldType: "decimalPlaces" | "decimals";
  name?: string;
  ticker?: string;
  metadataBase64?: string;
};

const TokenMetadataSchema = z
  .object({
    token: z.string(),
    decimals: z.number().nonnegative().optional(),
    fieldType: z.enum(["decimalPlaces", "decimals"]).optional(),
    name: z.string().optional(),
    ticker: z.string().optional(),
    metadataBase64: z.string().optional(),
  })
  .passthrough();

const cache = new Map<string, TokenMetadataEntry>();

function deriveFieldType(entry: TokenMetadataEntry): "decimalPlaces" | "decimals" {
  if (entry.fieldType === "decimalPlaces" || entry.fieldType === "decimals") {
    return entry.fieldType;
  }
  return "decimals";
}

function parseMetadataBase64(metadataBase64?: string | null): Partial<TokenMetadataEntry> {
  if (!metadataBase64 || typeof metadataBase64 !== "string") {
    return {};
  }

  const parsed = parseTokenMetadata(metadataBase64);
  if (!parsed) {
    return {};
  }

  const decimals = typeof parsed.decimals === "number" ? parsed.decimals : undefined;
  const fieldType = parsed.fieldType === "decimalPlaces" ? "decimalPlaces" : "decimals";
  return {
    decimals,
    fieldType,
    name: typeof parsed.name === "string" ? parsed.name : undefined,
    ticker: typeof parsed.ticker === "string" ? parsed.ticker : undefined,
    metadataBase64,
  } satisfies Partial<TokenMetadataEntry>;
}

function mergeEntries(base: TokenMetadataEntry | undefined, next: Partial<TokenMetadataEntry>): TokenMetadataEntry | undefined {
  if (!base && !next.token) {
    return undefined;
  }
  const seed: TokenMetadataEntry = base ?? {
    token: next.token ?? "",
    decimals: next.decimals ?? 0,
    fieldType: next.fieldType ?? "decimals",
  };

  const merged: TokenMetadataEntry = {
    ...seed,
    ...next,
  };

  if (!merged.decimals || merged.decimals < 0 || !Number.isFinite(merged.decimals)) {
    merged.decimals = next.decimals ?? seed.decimals ?? 0;
  }

  merged.fieldType = deriveFieldType(merged);
  return merged;
}

function buildEntry(tokenId: string, record: TokenMetadataRecord): TokenMetadataEntry | null {
  const parsed = TokenMetadataSchema.safeParse({ token: tokenId, ...record });
  if (!parsed.success) {
    try {

    } catch {}
    return null;
  }

  const entryFromRecord: Partial<TokenMetadataEntry> = {
    token: parsed.data.token,
    decimals: parsed.data.decimals,
    fieldType: parsed.data.fieldType,
    name: parsed.data.name,
    ticker: parsed.data.ticker,
    metadataBase64: parsed.data.metadataBase64,
  };

  const enriched = mergeEntries(
    entryFromRecord as TokenMetadataEntry,
    parseMetadataBase64(parsed.data.metadataBase64),
  );

  return enriched ?? null;
}

async function fetchFromSdk(tokenId: string): Promise<TokenMetadataEntry | null> {
  const record = await getTokenMetadataRecord(tokenId);
  if (!record) {
    return null;
  }

  return buildEntry(tokenId, record);
}

async function fetchFromWallet(tokenId: string): Promise<TokenMetadataEntry | null> {
  if (typeof window === "undefined") {
    return null;
  }
  const provider: any = window.keeta;
  if (!provider) {
    return null;
  }

  const walletRecord: Partial<TokenMetadataRecord> = {};

  try {
    const base = await provider.getBaseToken?.();
    if (base && typeof base === "object") {
      const baseAddress = typeof base.address === "string" ? base.address : undefined;
      const isBase = baseAddress && tokenId === baseAddress;
      if (isBase && base.metadata) {
        walletRecord.metadataBase64 = typeof base.metadata === "string" ? base.metadata : undefined;
        walletRecord.decimals = typeof base.decimals === "number" ? base.decimals : undefined;
        walletRecord.fieldType = base.fieldType === "decimalPlaces" ? "decimalPlaces" : "decimals";
        walletRecord.name = typeof base.name === "string" ? base.name : undefined;
        walletRecord.ticker = typeof base.ticker === "string" ? base.ticker : undefined;
      }
    }
  } catch {}

  if (!walletRecord.metadataBase64) {
    try {
      const info = await provider.getAccountInfo?.(tokenId);
      if (info && typeof info === "object") {
        const parsed = z
          .object({
            metadata: z.string().optional(),
            name: z.string().optional(),
            symbol: z.string().optional(),
            ticker: z.string().optional(),
            decimals: z.number().optional(),
            decimalPlaces: z.number().optional(),
          })
          .passthrough()
          .safeParse(info);
        if (parsed.success) {
          walletRecord.metadataBase64 = parsed.data.metadata;
          walletRecord.name = parsed.data.name ?? walletRecord.name;
          walletRecord.ticker = parsed.data.ticker ?? parsed.data.symbol ?? walletRecord.ticker;
          walletRecord.decimals = parsed.data.decimals ?? parsed.data.decimalPlaces ?? walletRecord.decimals;
        }
      }
    } catch {}
  }

  if (!walletRecord.metadataBase64 && provider.history) {
    try {
      const history = await provider.history({ depth: 50 } as any);
      const records: any[] = Array.isArray(history?.records) ? history.records : Array.isArray(history) ? history : [];
      const match = records.find((record) => {
        const tokenCandidate = record?.token ?? record?.tokenAddress ?? record?.operation?.token;
        return typeof tokenCandidate === "string" && tokenCandidate === tokenId && record?.tokenMetadata;
      });
      if (match?.tokenMetadata) {
        walletRecord.metadataBase64 = typeof match.tokenMetadata === "string" ? match.tokenMetadata : undefined;
      }
    } catch {}
  }

  if (!walletRecord.metadataBase64 && !walletRecord.decimals && !walletRecord.name && !walletRecord.ticker) {
    return null;
  }

  const entry = buildEntry(tokenId, walletRecord as TokenMetadataRecord);
  return entry;
}

export async function getTokenMetadata(tokenId: string): Promise<TokenMetadataEntry | null> {
  if (!tokenId) {
    return null;
  }

  const cached = cache.get(tokenId);
  if (cached) {
    return cached;
  }

  let entry = await fetchFromSdk(tokenId);
  if (!entry) {
    entry = await fetchFromWallet(tokenId);
  }
  if (!entry) {
    return null;
  }

  cache.set(tokenId, entry);
  return entry;
}

export async function prefetchTokenMetadata(tokenIds: string[]): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const tokenId of tokenIds) {
    if (!tokenId || cache.has(tokenId)) {
      continue;
    }
    tasks.push(
      getTokenMetadata(tokenId)
        .then(() => undefined)
        .catch((error) => {
          try {

          } catch {}
        }),
    );
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}

export function getCachedTokenMetadata(tokenId: string): TokenMetadataEntry | null {
  return cache.get(tokenId) ?? null;
}

export function setTokenMetadataCache(entries: TokenMetadataEntry[]): void {
  for (const entry of entries) {
    if (!entry || !entry.token) {
      continue;
    }
    const normalized = mergeEntries(entry, parseMetadataBase64(entry.metadataBase64));
    if (normalized) {
      cache.set(entry.token, normalized);
    }
  }
}

export function clearTokenMetadataCache(): void {
  cache.clear();
}
