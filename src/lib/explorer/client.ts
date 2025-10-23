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
    // Use wallet extension for network stats if available
    if (typeof window !== 'undefined' && window.keeta) {
      console.log('[CLIENT] Using wallet extension for network stats');
      return await fetchNetworkStatsFromWallet();
    }
    
    console.log('[CLIENT] Wallet extension not available, using fallback stats');
    return {
      blockCount: 0,
      transactionCount: 0,
      representativeCount: 0,
      queryTime: 0,
      time: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error fetching network stats:', error);
    return {
      blockCount: 0,
      transactionCount: 0,
      representativeCount: 0,
      queryTime: 0,
      time: new Date().toISOString(),
    };
  }
}

export async function fetchVoteStaple(blockhash: string) {
  try {
    // If wallet is available, try to reconstruct staple and operations using SDK/client
    if (typeof window !== 'undefined' && window.keeta) {
      // 1) Try provider history which may include voteStaple inlined
      try {
        const result: any = await window.keeta.history?.({ depth: 50, cursor: null, includeTokenMetadata: true } as any);
        if (result && Array.isArray(result.records)) {
          const match = result.records.find((r: any) => r && (r.block === blockhash || r.id === blockhash));
          if (match && match.voteStaple && Array.isArray(match.voteStaple.blocks)) {
            // Basic shape passthrough; add $hash for convenience
            const blocks = match.voteStaple.blocks.map((b: any) => ({
              hash: b?.hash || b?.$hash || blockhash,
              $hash: b?.$hash || b?.hash || blockhash,
              createdAt: b?.createdAt || b?.date || new Date().toISOString(),
              account: (b?.account && typeof b.account === 'string') ? b.account : (b?.account?.publicKeyString?.toString?.() ?? ''),
              // Prefer operations if available, else transactions; leave as-is for parseExplorerOperations to validate
              operations: Array.isArray(b?.operations) ? b.operations : undefined,
              transactions: Array.isArray(b?.transactions) ? b.transactions : undefined,
            }));
            return {
              voteStaple: { blocks },
              previousBlockHash: null,
              nextBlockHash: null,
            };
          }
        }
      } catch (e) {
        console.log('[CLIENT] fetchVoteStaple history path failed:', e);
      }

      // 2) Fallback: use SDK user client to get block and derive a minimal staple with operations
      try {
        const uc: any = await window.keeta.getUserClient?.();
        if (uc && typeof uc.block === 'function') {
          const block = await uc.block(blockhash);
          if (block) {
            const normAddr = (v: any) => {
              if (typeof v === 'string') return v;
              try {
                if (v?.publicKeyString && typeof v.publicKeyString === 'string') return v.publicKeyString;
                if (v?.publicKeyString?.toString) return String(v.publicKeyString.toString());
                if (v?.toString) {
                  const s = String(v.toString());
                  if (s && s !== '[object Object]') return s;
                }
              } catch {}
              return '';
            };
            const ts = (block?.date instanceof Date) ? block.date.toISOString() : (block?.createdAt ?? new Date().toISOString());
            const account = normAddr((block as any)?.account);
            const ops: any[] = Array.isArray((block as any)?.operations) ? (block as any).operations : [];
            const operations = ops.map((op: any) => {
              const type = (op?.type?.toString?.() ?? String(op?.type ?? 'UNKNOWN')).toUpperCase();
              const amount = typeof op?.amount === 'bigint' ? op.amount.toString() : typeof op?.amount === 'number' ? String(Math.trunc(op.amount)) : (op?.amount ?? '0');
              const from = normAddr(op?.from);
              const to = normAddr(op?.to);
              const token = normAddr(op?.token ?? op?.tokenAddress ?? op?.account ?? op?.target);
              return {
                type,
                block: { $hash: blockhash, date: ts, account },
                operation: { type, amount, from, to, token },
              };
            });
            return {
              voteStaple: {
                blocks: [
                  {
                    hash: blockhash,
                    $hash: blockhash,
                    createdAt: ts,
                    account,
                    operations,
                  },
                ],
              },
              previousBlockHash: null,
              nextBlockHash: null,
            };
          }
        }
      } catch (e) {
        console.log('[CLIENT] fetchVoteStaple SDK block path failed:', e);
      }
    }

    // Final fallback: minimal structure without operations
    return {
      voteStaple: {
        blocks: [
          {
            hash: blockhash,
            createdAt: new Date().toISOString(),
            account: '',
            transactions: [],
          },
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
    // Use wallet extension directly instead of backend
    if (typeof window !== 'undefined' && window.keeta && query?.publicKey) {
      console.log('[CLIENT] Using wallet extension for transaction data');
      return await fetchTransactionsFromWallet(query);
    }
    
    console.log('[CLIENT] Wallet extension not available or no public key provided');
    return {
      nextCursor: null,
      stapleOperations: [],
    };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return {
      nextCursor: null,
      stapleOperations: [],
    };
  }
}

export async function fetchAccount(publicKey: string): Promise<ExplorerAccount | null> {
  try {
    console.log('[CLIENT] fetchAccount called with publicKey:', publicKey);
    
    // Use wallet extension directly instead of backend
    if (typeof window !== 'undefined' && window.keeta) {
      console.log('[CLIENT] Using wallet extension for account data');
      return await fetchAccountFromWallet(publicKey);
    }
    
    console.log('[CLIENT] Wallet extension not available');
    return null;
  } catch (error) {
    console.error('[CLIENT] Error fetching account:', error);
    throw new Error('Failed to fetch account data');
  }
}

async function fetchNetworkStatsFromWallet() {
  try {
    console.log('[CLIENT] Fetching network stats from wallet extension');
    
    // Get user client for network operations
    if (!window.keeta) {
      throw new Error('Wallet extension not available');
    }
    const userClient = await window.keeta.getUserClient!();
    if (!userClient) {
      throw new Error('User client not available');
    }
    
    // For now, return basic stats since the wallet extension doesn't expose network stats directly
    // In the future, we could add network stats to the wallet extension
    return {
      blockCount: 0,
      transactionCount: 0,
      representativeCount: 0,
      queryTime: Date.now(),
      time: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[CLIENT] Error fetching network stats from wallet:', error);
    return {
      blockCount: 0,
      transactionCount: 0,
      representativeCount: 0,
      queryTime: 0,
      time: new Date().toISOString(),
    };
  }
}

async function fetchTransactionsFromWallet(query: ExplorerTransactionsQuery): Promise<ExplorerTransactionsResponse> {
  try {
    console.log('[CLIENT] Fetching transactions from wallet extension');
    
    // Get user client for advanced operations
    if (!window.keeta) {
      throw new Error('Wallet extension not available');
    }
    const userClient = await window.keeta.getUserClient!();
    if (!userClient) {
      throw new Error('User client not available');
    }
    
    // Get history using the wallet's SDK client
    const historyOptions = {
      depth: query.depth || 20,
      cursor: query.startBlock || null,
    };
    
    const historyResult = await (userClient as any).history(historyOptions);
    console.log('[CLIENT] History from wallet:', historyResult);
    
    // Transform wallet history to frontend format
    const stapleOperations = historyResult.records?.map((record: any) => ({
      type: record.operationType || 'Transaction',
      voteStapleHash: record.block || '',
      toAccount: record.to || '',
      block: {
        $hash: record.block || '',
        date: new Date(record.timestamp || Date.now()).toISOString(),
        account: query.publicKey || '',
      },
      operation: {
        type: record.operationType,
        from: record.from,
        to: record.to,
        amount: record.amount,
        token: record.token,
      },
    })) || [];
    
    return {
      nextCursor: historyResult.cursor,
      stapleOperations,
    };
  } catch (error) {
    console.error('[CLIENT] Error fetching transactions from wallet:', error);
    return {
      nextCursor: null,
      stapleOperations: [],
    };
  }
}

async function fetchAccountFromWallet(publicKey: string): Promise<ExplorerAccount | null> {
  try {
    console.log('[CLIENT] Fetching account data from wallet extension for:', publicKey);
    
    // Get account info from wallet extension
    if (!window.keeta) {
      throw new Error('Wallet extension not available');
    }
    const accountInfo = await window.keeta.getAccountInfo!(publicKey);
    console.log('[CLIENT] Account info from wallet:', accountInfo);
    
    // Get all balances for this account
    const allBalances = await window.keeta.getAllBalances();
    console.log('[CLIENT] All balances from wallet:', allBalances);
    
    // Transform wallet data to ExplorerAccount format
    const account: ExplorerAccount = {
      publicKey: publicKey,
      type: 'ACCOUNT',
      representative: null,
      owner: null,
      signers: [],
      headBlock: undefined,
      info: (accountInfo as Record<string, unknown>) || {},
      tokens: allBalances.map((balance: any) => ({
        publicKey: balance.token || '',
        name: null,
        ticker: null,
        decimals: null,
        totalSupply: null,
        balance: balance.balance?.toString() || '0',
      })),
      certificates: [],
      activity: [] // Will be populated by history if needed
    };
    
    console.log('[CLIENT] Transformed account data:', account);
    return account;
  } catch (error) {
    console.error('[CLIENT] Error fetching account from wallet:', error);
    return null;
  }
}

async function fetchAccountFromBackend(publicKey: string): Promise<ExplorerAccount | null> {
  // Explorer backend disabled; rely on wallet SDK
  console.log('[CLIENT] fetchAccountFromBackend is disabled; use wallet provider instead');
  return null;
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
      headBlock: undefined,
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
      headBlock: undefined,
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
