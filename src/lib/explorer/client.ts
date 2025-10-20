import "server-only";

import { ZodError, z } from "zod";

// Default base URL for the explorer API - point to NestJS backend
const defaultBaseUrl = "http://localhost:8080/api/explorer";

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
  const timeout = Number(process.env.EXPLORER_API_TIMEOUT_MS ?? 10000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
      cache: init?.cache ?? 'no-store',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      let errorText = 'Request failed';
      try {
        const errorData = await response.json().catch(() => ({}));
        errorText = errorData.message || response.statusText || 'Unknown error';
      } catch (e) {
        errorText = await response.text().catch(() => 'Failed to parse error response');
      }
      throw new Error(`Explorer API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    console.error('API request failed:', error);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw new Error(`Network error: ${error.message}`);
    }
    throw new Error('An unexpected error occurred');
  } finally {
    clearTimeout(timer);
  }
}

const accountSchema = z.object({
  account: z.object({
    publicKey: z.string(),
    type: z.string(),
    representative: z.string().nullable().optional(),
    owner: z.string().nullable().optional(),
    signers: z.array(z.string()).optional(),
    headBlock: z.string().optional(),
    info: z.record(z.string(), z.unknown()).optional(),
    tokens: z.array(z.object({
      publicKey: z.string(),
      name: z.string().optional().nullable(),
      ticker: z.string().optional().nullable(),
      decimals: z.number().optional().nullable(),
      totalSupply: z.string().optional().nullable(),
      balance: z.string(),
    })).default([]),
    certificates: z.array(z.object({
      issuer: z.string().nullable().optional(),
      hash: z.string(),
      issuedAt: z.union([z.string(), z.date()]).optional(),
      expiresAt: z.union([z.string(), z.date()]).optional(),
    })).optional(),
  }).passthrough(),
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

export type ExplorerTransactionsResponse = z.infer<typeof transactionsSchema>;

export function parseExplorerOperation(data: unknown): ExplorerOperation | null {
  const parsed = explorerOperationSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function parseExplorerOperations(data: unknown[]): ExplorerOperation[] {
  return data
    .map(parseExplorerOperation)
    .filter((operation): operation is ExplorerOperation => operation !== null);
}

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
    supply: z.union([z.string(), z.number(), z.object({})]).optional(),
    currencyCode: z.string().optional().nullable(),
    decimalPlaces: z.number().optional().nullable(),
    accessMode: z.string().optional().nullable(),
    defaultPermissions: z.array(z.string()).optional(),
    type: z.string().optional().nullable(),
    headBlock: z.string().optional().nullable(),
  }).passthrough(),
});

const storageSchema = accountSchema; // Storage details align with account details for explorer API

const accountCertificateSchema = z.object({
  certificate: z.object({
    hash: z.string(),
    issuerName: z.string().nullable().optional(),
    subjectPublicKey: z.string().nullable().optional(),
    issuedAt: z.union([z.string(), z.date()]).optional(),
    expiresAt: z.union([z.string(), z.date()]).optional(),
    valid: z.boolean().optional(),
    serial: z.any().optional(),
    trusted: z.boolean().optional(),
    chain: z.array(z.object({
      hash: z.string(),
      issuerName: z.string().nullable().optional(),
      subjectName: z.string().nullable().optional(),
      serial: z.any().optional(),
      trusted: z.boolean().optional(),
      isSelfSigned: z.boolean().optional(),
      issuedAt: z.union([z.string(), z.date()]).optional(),
      expiresAt: z.union([z.string(), z.date()]).optional(),
      attributes: z.array(z.object({
        name: z.string(),
        value: z.string().optional().nullable(),
        sensitive: z.boolean().optional(),
      })).optional(),
      subjectDN: z.array(z.object({ name: z.string(), value: z.string().nullable().optional() })).optional(),
      issuerDN: z.array(z.object({ name: z.string(), value: z.string().nullable().optional() })).optional(),
    })).optional(),
    pem: z.string().optional(),
    attributes: z.array(z.object({
      name: z.string(),
      value: z.string().optional().nullable(),
      sensitive: z.boolean().optional(),
    })).optional(),
    subjectDN: z.array(z.object({ name: z.string(), value: z.string().nullable().optional() })).optional(),
    issuerDN: z.array(z.object({ name: z.string(), value: z.string().nullable().optional() })).optional(),
  }).passthrough(),
});

export type ExplorerAccount = z.infer<typeof accountSchema>["account"];
export type ExplorerVoteStapleResponse = z.infer<typeof voteStapleSchema>;
export type ExplorerToken = z.infer<typeof tokenSchema>["token"];
export type ExplorerCertificate = z.infer<typeof accountCertificateSchema>["certificate"];

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

export async function fetchTransactions(query?: ExplorerTransactionsQuery): Promise<ExplorerTransactionsResponse> {
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

export async function fetchAccount(publicKey: string): Promise<ExplorerAccount | null> {
  const json = await fetchFromExplorer<unknown>(`account/${publicKey}`);
  const parsed = accountSchema.safeParse(json);
  if (!parsed.success) {
    return null;
  }
  return parsed.data.account;
}

export async function fetchAccountCertificate(accountPublicKey: string, certificateHash: string) {
  const json = await fetchFromExplorer<unknown>(
    `account/${accountPublicKey}/certificate/${certificateHash}`,
  );
  const parsed = accountCertificateSchema.safeParse(json);
  if (!parsed.success) {
    return null;
  }
  return parsed.data.certificate;
}

export async function fetchStorage(accountPublicKey: string) {
  const json = await fetchFromExplorer<unknown>(`storage/${accountPublicKey}`);
  const parsed = storageSchema.safeParse(json);
  if (!parsed.success) {
    return null;
  }
  return parsed.data.account;
}

export async function fetchToken(tokenPublicKey: string) {
  const json = await fetchFromExplorer<unknown>(`token/${tokenPublicKey}`);
  const parsed = tokenSchema.safeParse(json);
  if (!parsed.success) {
    return null;
  }
  return parsed.data.token;
}

export async function fetchTokensBatch(tokenPublicKeys: string[]) {
  const json = await fetchFromExplorer<unknown>(
    "token",
    {
      method: "POST",
      body: JSON.stringify({ publicKey: tokenPublicKeys }),
    },
  );
  return json as Record<string, unknown>;
}
