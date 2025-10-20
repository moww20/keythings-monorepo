import "server-only";

import { z } from "zod";

// Note: Keeta Network uses SDK calls, not HTTP API calls
// This client provides mock data for development purposes
// In production, data should come from the Keeta SDK via wallet extension

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
  // Mock data for development - in production, this should come from Keeta SDK
  return {
    blockCount: 12345,
    transactionCount: 67890,
    representativeCount: 50,
    queryTime: 150,
    time: new Date().toISOString(),
  };
}

export async function fetchVoteStaple(blockhash: string) {
  // Mock data for development - in production, this should come from Keeta SDK
  return {
    voteStaple: {
      blocks: [
        {
          hash: blockhash,
          createdAt: new Date().toISOString(),
          account: "keeta_mock_account",
          transactions: [],
        }
      ],
    },
    previousBlockHash: null,
    nextBlockHash: null,
  };
}

export interface ExplorerTransactionsQuery {
  startBlock?: string;
  depth?: number;
  publicKey?: string;
}

export async function fetchTransactions(query?: ExplorerTransactionsQuery): Promise<ExplorerTransactionsResponse> {
  // Mock data for development - in production, this should come from Keeta SDK
  return {
    nextCursor: null,
    stapleOperations: [
      {
        type: "SEND",
        block: {
          $hash: "mock_block_hash_123",
          date: new Date().toISOString(),
          account: query?.publicKey || "keeta_mock_account",
        },
        operation: {
          amount: "1000000",
          to: "keeta_recipient_account",
        },
      }
    ],
  };
}

export async function fetchAccount(publicKey: string): Promise<ExplorerAccount | null> {
  // Mock data for development - in production, this should come from Keeta SDK
  return {
    publicKey,
    type: "ACCOUNT",
    representative: null,
    owner: null,
    signers: [],
    headBlock: "mock_head_block_hash",
    info: {},
    tokens: [
      {
        publicKey: "keeta_mock_token",
        name: "Mock Token",
        ticker: "MOCK",
        decimals: 6,
        totalSupply: "1000000000000",
        balance: "1000000",
      }
    ],
    certificates: [],
  };
}

export async function fetchAccountCertificate(accountPublicKey: string, certificateHash: string) {
  // Mock data for development - in production, this should come from Keeta SDK
  return {
    hash: certificateHash,
    issuerName: "Mock Issuer",
    subjectPublicKey: accountPublicKey,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
    valid: true,
    serial: "mock_serial_123",
    trusted: true,
    chain: [],
    pem: "-----BEGIN CERTIFICATE-----\nMOCK_CERTIFICATE_DATA\n-----END CERTIFICATE-----",
    attributes: [],
    subjectDN: [],
    issuerDN: [],
  };
}

export async function fetchStorage(accountPublicKey: string) {
  // Mock data for development - in production, this should come from Keeta SDK
  return {
    publicKey: accountPublicKey,
    type: "STORAGE",
    representative: null,
    owner: null,
    signers: [],
    headBlock: "mock_storage_head_block",
    info: {},
    tokens: [],
    certificates: [],
  };
}

export async function fetchToken(tokenPublicKey: string) {
  // Mock data for development - in production, this should come from Keeta SDK
  return {
    publicKey: tokenPublicKey,
    name: "Mock Token",
    ticker: "MOCK",
    totalSupply: "1000000000000",
    decimals: 6,
    supply: "1000000000000",
    currencyCode: "MOCK",
    decimalPlaces: 6,
    accessMode: "PUBLIC",
    defaultPermissions: ["ACCESS", "SEND"],
    type: "TOKEN",
    headBlock: "mock_token_head_block",
  };
}

export async function fetchTokensBatch(tokenPublicKeys: string[]) {
  // Mock data for development - in production, this should come from Keeta SDK
  const result: Record<string, unknown> = {};
  for (const publicKey of tokenPublicKeys) {
    result[publicKey] = {
      publicKey,
      name: `Mock Token ${publicKey.slice(-4)}`,
      ticker: `MOCK${publicKey.slice(-2)}`,
      totalSupply: "1000000000000",
      decimals: 6,
    };
  }
  return result;
}
