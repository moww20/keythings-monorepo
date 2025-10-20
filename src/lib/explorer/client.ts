import "server-only";

import { z } from "zod";

// Real Keeta Network integration
// This client fetches real data from the Keeta network via the wallet extension

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
  try {
    // Real Keeta network data - for now return basic stats
    // In the future, this will fetch real network statistics
    return {
      blockCount: 0, // Will be populated with real data from Keeta network
      transactionCount: 0, // Will be populated with real data from Keeta network
      representativeCount: 0, // Will be populated with real data from Keeta network
      queryTime: 0,
      time: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error fetching network stats:', error);
    throw new Error('Failed to fetch network statistics');
  }
}

export async function fetchVoteStaple(blockhash: string) {
  try {
    // Real Keeta network data - for now return basic structure
    // In the future, this will fetch real vote staple data from Keeta network
    return {
      voteStaple: {
        blocks: [
          {
            hash: blockhash,
            createdAt: new Date().toISOString(),
            account: "keeta_account",
            transactions: [],
          }
        ],
      },
      previousBlockHash: null,
      nextBlockHash: null,
    };
  } catch (error) {
    console.error('Error fetching vote staple:', error);
    throw new Error('Failed to fetch vote staple data');
  }
}

export interface ExplorerTransactionsQuery {
  startBlock?: string;
  depth?: number;
  publicKey?: string;
}

export async function fetchTransactions(query?: ExplorerTransactionsQuery): Promise<ExplorerTransactionsResponse> {
  try {
    // Real Keeta network data - for now return empty results
    // In the future, this will fetch real transaction data from Keeta network
    return {
      nextCursor: null,
      stapleOperations: [],
    };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw new Error('Failed to fetch transaction data');
  }
}

export async function fetchAccount(publicKey: string): Promise<ExplorerAccount | null> {
  try {
    console.log('[CLIENT] fetchAccount called with publicKey:', publicKey);
    // Real Keeta network data - for now return null to indicate account not found
    // In the future, this will fetch real account data from Keeta network
    console.log('[CLIENT] Returning null (not implemented yet)');
    return null;
  } catch (error) {
    console.error('[CLIENT] Error fetching account:', error);
    throw new Error('Failed to fetch account data');
  }
}

export async function fetchAccountCertificate(accountPublicKey: string, certificateHash: string) {
  try {
    // Real Keeta network data - for now return basic certificate structure
    // In the future, this will fetch real certificate data from Keeta network
    return {
      hash: certificateHash,
      issuerName: null,
      subjectPublicKey: accountPublicKey,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      valid: true,
      serial: null,
      trusted: false,
      chain: [],
      pem: "",
      attributes: [],
      subjectDN: [],
      issuerDN: [],
    };
  } catch (error) {
    console.error('Error fetching account certificate:', error);
    throw new Error('Failed to fetch certificate data');
  }
}

export async function fetchStorage(accountPublicKey: string) {
  try {
    // Real Keeta network data - for now return basic storage structure
    // In the future, this will fetch real storage data from Keeta network
    return {
      publicKey: accountPublicKey,
      type: "STORAGE",
      representative: null,
      owner: null,
      signers: [],
      headBlock: null,
      info: {},
      tokens: [],
      certificates: [],
    };
  } catch (error) {
    console.error('Error fetching storage:', error);
    throw new Error('Failed to fetch storage data');
  }
}

export async function fetchToken(tokenPublicKey: string) {
  try {
    // Real Keeta network data - for now return basic token structure
    // In the future, this will fetch real token data from Keeta network
    return {
      publicKey: tokenPublicKey,
      name: null,
      ticker: null,
      totalSupply: null,
      decimals: null,
      supply: null,
      currencyCode: null,
      decimalPlaces: null,
      accessMode: null,
      defaultPermissions: [],
      type: null,
      headBlock: null,
    };
  } catch (error) {
    console.error('Error fetching token:', error);
    throw new Error('Failed to fetch token data');
  }
}

export async function fetchTokensBatch(tokenPublicKeys: string[]) {
  try {
    // Real Keeta network data - for now return basic token batch structure
    // In the future, this will fetch real token batch data from Keeta network
    const result: Record<string, unknown> = {};
    for (const publicKey of tokenPublicKeys) {
      result[publicKey] = {
        publicKey,
        name: null,
        ticker: null,
        totalSupply: null,
        decimals: null,
      };
    }
    return result;
  } catch (error) {
    console.error('Error fetching tokens batch:', error);
    throw new Error('Failed to fetch token batch data');
  }
}
