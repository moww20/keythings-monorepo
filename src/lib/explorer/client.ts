import "server-only";

import { ZodError, z } from "zod";

const defaultBaseUrl = "https://explorer.test.keeta.com/api/v1";

const explorerConfigSchema = z.object({
  baseUrl: z.string().url(),
});

let cachedConfig: z.infer<typeof explorerConfigSchema> | null = null;

function resolveConfig(): z.infer<typeof explorerConfigSchema> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const baseUrl = process.env.EXPLORER_API_BASE_URL
    ?? process.env.NEXT_PUBLIC_EXPLORER_API_BASE_URL
    ?? defaultBaseUrl;

  const parsed = explorerConfigSchema.safeParse({ baseUrl });

  if (!parsed.success) {
    throw parsed.error;
  }

  cachedConfig = parsed.data;
  return parsed.data;
}

function buildUrl(pathname: string, searchParams?: Record<string, string | number | undefined>) {
  const { baseUrl } = resolveConfig();
  const url = new URL(pathname.replace(/^\//, ""), baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

async function fetchFromExplorer<T>(
  pathname: string,
  init?: RequestInit,
  searchParams?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = buildUrl(pathname, searchParams);
  const timeout = Number(process.env.EXPLORER_API_TIMEOUT_MS ?? 15000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
      cache: init?.cache ?? "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Explorer API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

const accountSchema = z.object({
  account: z.object({
    publicKey: z.string(),
    type: z.string(),
    tokens: z.array(z.object({
      publicKey: z.string(),
      name: z.string().optional(),
      ticker: z.string().optional(),
      balance: z.string(),
    })).default([]),
  }),
});

const explorerOperationSchema = z.object({
  type: z.string(),
  voteStapleHash: z.string().optional(),
  toAccount: z.string().optional(),
  block: z.object({
    $hash: z.string(),
    date: z.union([z.string(), z.date()]),
    account: z.string().optional(),
  }).passthrough(),
  operation: z.record(z.string(), z.unknown()).optional(),
  operationSend: z.record(z.string(), z.unknown()).optional(),
  operationReceive: z.record(z.string(), z.unknown()).optional(),
  operationForward: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export type ExplorerOperation = z.infer<typeof explorerOperationSchema>;

const transactionsSchema = z.object({
  nextCursor: z.string().nullable(),
  stapleOperations: z.array(explorerOperationSchema),
});

const networkStatsSchema = z.object({
  stats: z.object({
    blockCount: z.number(),
    transactionCount: z.number(),
    representativeCount: z.number(),
    queryTime: z.number(),
    time: z.string().or(z.date()),
  }),
});

const voteStapleSchema = z.object({
  voteStaple: z.object({
    blocks: z.array(z.object({
      hash: z.string(),
      createdAt: z.string(),
      account: z.string(),
      transactions: z.array(z.unknown()),
    })),
  }),
  previousBlockHash: z.string().optional().nullable(),
  nextBlockHash: z.string().optional().nullable(),
});

const tokenSchema = z.object({
  token: z.object({
    publicKey: z.string(),
    name: z.string().nullable(),
    ticker: z.string().nullable(),
    totalSupply: z.string().nullable(),
    decimals: z.number().nullable(),
  }),
});

const storageSchema = accountSchema; // Storage details align with account details for explorer API

export async function fetchNetworkStats() {
  const json = await fetchFromExplorer<unknown>("network/stats");
  return networkStatsSchema.parse(json).stats;
}

export async function fetchVoteStaple(blockhash: string) {
  const json = await fetchFromExplorer<unknown>(`network/staple/${blockhash}`);
  return voteStapleSchema.parse(json);
}

export interface ExplorerTransactionsQuery {
  startBlock?: string;
  depth?: number;
  publicKey?: string;
}

export async function fetchTransactions(query?: ExplorerTransactionsQuery) {
  const searchParams = query
    ? {
        startBlock: query.startBlock,
        depth: query.depth,
        publicKey: query.publicKey,
      }
    : undefined;
  const json = await fetchFromExplorer<unknown>("transaction", undefined, searchParams);
  return transactionsSchema.parse(json);
}

export async function fetchAccount(publicKey: string) {
  const json = await fetchFromExplorer<unknown>(`account/${publicKey}`);
  return accountSchema.parse(json).account;
}

export async function fetchAccountCertificate(accountPublicKey: string, certificateHash: string) {
  return fetchFromExplorer(`account/${accountPublicKey}/certificate/${certificateHash}`);
}

export async function fetchStorage(accountPublicKey: string) {
  const json = await fetchFromExplorer<unknown>(`storage/${accountPublicKey}`);
  return storageSchema.parse(json).account;
}

export async function fetchToken(tokenPublicKey: string) {
  const json = await fetchFromExplorer<unknown>(`token/${tokenPublicKey}`);
  return tokenSchema.parse(json).token;
}

export async function fetchTokensBatch(tokenPublicKeys: string[]) {
  const json = await fetchFromExplorer<unknown>("token", {
    method: "POST",
    body: JSON.stringify({ tokens: tokenPublicKeys }),
  });
  return json as Record<string, unknown>;
}
