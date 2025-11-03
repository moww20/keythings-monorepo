import { z } from "zod";

import { createTimedCache } from "../cache/timed-cache";

/**
 * Explorer Client (SSR-safe, wallet-only)
 *
 * IMPORTANT:
 * - This module must remain SSR-safe. Do NOT import any SDKs that ship native/N-API bindings here.
 * - Reads should use the wallet provider when available (window.keeta). On the server it will gracefully
 *   return empty/fallback data. This keeps build output clean and avoids SSR bundling issues.
 * - For client components that need SDK-first reads, prefer importing from:
 *     '@/lib/explorer/client-reads-browser'
 *   which can utilize dynamic SDK imports safely in the browser.
 * - For server components (or Next API routes), prefer importing from:
 *     '@/lib/explorer/client-reads-ssr'
 *   to guarantee no SDK is pulled into SSR bundles.
 */

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

const tokenMetadataSchema = z
  .union([
    z
      .object({
        name: z.string().optional().nullable(),
        ticker: z.string().optional().nullable(),
        symbol: z.string().optional().nullable(),
        decimals: z.number().optional().nullable(),
        decimalPlaces: z.number().optional().nullable(),
        fieldType: z.enum(["decimalPlaces", "decimals"]).optional().nullable(),
        metadata: z.string().optional().nullable(),
        raw: z.unknown().optional(),
      })
      .passthrough(),
    z.string(),
  ])
  .optional()
  .nullable();

const amountLikeSchema = z.union([z.string(), z.number(), z.bigint()]).optional();

const explorerOperationSchema = z
  .object({
    type: z.string(),
    voteStapleHash: z.string().optional(),
    toAccount: z.string().optional(),
    block: z
      .object({
        $hash: z.string(),
        date: z.union([z.string(), z.date()]),
        account: z.string().optional(),
      })
      .passthrough(),
    operation: z.record(z.string(), z.unknown()).optional(),
    operationSend: z.record(z.string(), z.unknown()).optional(),
    operationReceive: z.record(z.string(), z.unknown()).optional(),
    operationForward: z.record(z.string(), z.unknown()).optional(),
    // Flattened wallet history helpers
    amount: amountLikeSchema,
    rawAmount: amountLikeSchema,
    formattedAmount: z.string().optional(),
    token: z.string().optional(),
    tokenAddress: z.string().optional(),
    tokenTicker: z.string().optional(),
    tokenDecimals: z.number().optional(),
    tokenMetadata: tokenMetadataSchema,
    from: z.string().optional(),
    to: z.string().optional(),
    operationType: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

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

const walletNetworkStatsSchema = z.object({
  blockCount: z.number(),
  transactionCount: z.number(),
  representativeCount: z.number(),
  queryTime: z.number(),
  time: z.union([z.string(), z.date()]).transform((value) =>
    value instanceof Date ? value.toISOString() : value,
  ),
});

type NetworkStats = z.infer<typeof walletNetworkStatsSchema>;

const networkStatsCache = createTimedCache<string, NetworkStats>(30_000);

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

const PreferredNetworkSchema = z.enum(["test", "main"]);

function readPreferredNetworkFromStorage(): "test" | "main" | null {
  try {
    if (typeof window === "undefined" || !("localStorage" in window)) {
      return null;
    }
    const raw = window.localStorage.getItem("keeta.network");
    const parsed = PreferredNetworkSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function resolvePreferredNetwork(): "test" | "main" {
  const fromStorage = readPreferredNetworkFromStorage();
  if (fromStorage) {
    return fromStorage;
  }

  const envValue =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_KEETA_NETWORK) || undefined;
  const parsed = PreferredNetworkSchema.safeParse(envValue);
  return parsed.success ? parsed.data : "test";
}

type SdkNetworkClientCache = {
  client: unknown;
  network: "test" | "main";
};

let cachedSdkNetworkClient: SdkNetworkClientCache | null = null;

async function resolveNetworkStats(): Promise<NetworkStats> {
  try {
    if (typeof window !== "undefined") {
      try {
        console.log("[CLIENT] Using SDK read client for network stats");
        return await fetchNetworkStatsFromSdk();
      } catch (sdkError) {
        console.warn("[CLIENT] SDK network stats fetch failed", sdkError);
        if (window.keeta) {
          return await fetchNetworkStatsFromWallet();
        }
        console.log("[CLIENT] Wallet extension not available, using fallback stats");
      }
    } else {
      console.log("[CLIENT] resolveNetworkStats running on server; SDK not available");
    }
  } catch (error) {
    console.error("Error fetching network stats:", error);
  }

  console.warn("[CLIENT] Returning fallback network stats (wallet unavailable or failed)");
  return {
    blockCount: 0,
    transactionCount: 0,
    representativeCount: 0,
    queryTime: 0,
    time: new Date().toISOString(),
  } satisfies NetworkStats;
}

export async function fetchNetworkStats(options: { forceRefresh?: boolean } = {}): Promise<NetworkStats> {
  return networkStatsCache.get('default', () => resolveNetworkStats(), {
    forceRefresh: options.forceRefresh,
  });
}

async function getSdkNetworkClient(): Promise<any> {
  if (typeof window === "undefined") {
    throw new Error("Keeta SDK client unavailable on server");
  }

  const preferredNetwork = resolvePreferredNetwork();
  console.log(`[CLIENT] Resolving SDK UserClient for network: ${preferredNetwork}`);
  if (cachedSdkNetworkClient && cachedSdkNetworkClient.network === preferredNetwork) {
    return cachedSdkNetworkClient.client;
  }

  const sdkModule = await import("@keetanetwork/keetanet-client");
  const { UserClient, lib } = sdkModule as { UserClient?: any; lib?: any };
  if (!UserClient || !lib) {
    throw new Error("Keeta SDK UserClient not available");
  }

  const seed = lib.Account.generateRandomSeed({ asString: true });
  const account = lib.Account.fromSeed(seed, 0);

  let clientCandidate =
    typeof UserClient.fromNetwork === "function"
      ? UserClient.fromNetwork(preferredNetwork, account)
      : new UserClient({ network: preferredNetwork, account });

  clientCandidate = await Promise.resolve(clientCandidate);

  cachedSdkNetworkClient = {
    client: clientCandidate,
    network: preferredNetwork,
  };

  console.log('[CLIENT] SDK UserClient initialized');
  return clientCandidate;
}

async function fetchNetworkStatsFromSdk(): Promise<NetworkStats> {
  const userClient = await getSdkNetworkClient();
  const lowClient = (userClient as any)?.client;
  if (!lowClient) {
    console.warn('[CLIENT] SDK low-level client not available on UserClient');
    return {
      blockCount: 0,
      transactionCount: 0,
      representativeCount: 0,
      queryTime: 0,
      time: new Date().toISOString(),
    } satisfies NetworkStats;
  }

  const now = typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => Date.now();
  const t0 = now();

  // Prefer getNodeStats; fall back to getNetworkStatus if needed
  let ledgerStats: any | null = null;
  try {
    if (typeof lowClient.getNodeStats === 'function') {
      const nodeStats = await lowClient.getNodeStats();
      ledgerStats = nodeStats?.ledger ?? null;
      console.debug('[CLIENT] SDK getNodeStats().ledger:', ledgerStats);
    } else if (typeof lowClient.getNetworkStatus === 'function') {
      const status = await lowClient.getNetworkStatus(2000);
      const firstOnline = Array.isArray(status) ? status.find((s: any) => s?.online) : null;
      ledgerStats = firstOnline?.ledger ?? null;
      console.debug('[CLIENT] SDK getNetworkStatus() -> ledger (first online):', ledgerStats);
    } else {
      console.warn('[CLIENT] Neither getNodeStats nor getNetworkStatus available on SDK Client');
    }
  } catch (err) {
    console.warn('[CLIENT] Error invoking SDK network stats methods:', err);
  }

  const t1 = now();
  const result = ledgerStats && typeof ledgerStats === 'object'
    ? {
        blockCount: Number(ledgerStats.blockCount ?? 0),
        transactionCount: Number(ledgerStats.transactionCount ?? 0),
        representativeCount: Number(ledgerStats.representativeCount ?? 0),
        queryTime: Math.max(0, Math.round(t1 - t0)),
        time: String(ledgerStats.moment ?? new Date().toISOString()),
      }
    : {
        blockCount: 0,
        transactionCount: 0,
        representativeCount: 0,
        queryTime: Math.max(0, Math.round(t1 - t0)),
        time: new Date().toISOString(),
      };

  console.debug('[CLIENT] Mapped SDK network stats:', result);

  const parsed = walletNetworkStatsSchema.safeParse(result);
  if (!parsed.success) {
    console.error('[CLIENT] SDK network stats schema validation failed:', parsed.error);
    return {
      blockCount: 0,
      transactionCount: 0,
      representativeCount: 0,
      queryTime: result.queryTime,
      time: result.time,
    } satisfies NetworkStats;
  }

  return parsed.data;
}

export async function fetchVoteStaple(blockhash: string) {
  try {
    // If wallet is available, try to reconstruct staple and operations using wallet history
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
    // Wallet-only path
    if (typeof window !== 'undefined' && window.keeta && query?.publicKey) {
      console.log('[CLIENT] Using wallet extension for transaction data');
      return await fetchTransactionsFromWallet(query);
    }

    console.log('[CLIENT] Wallet extension not available or no public key provided');
    return { nextCursor: null, stapleOperations: [] };
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

async function fetchNetworkStatsFromWallet(): Promise<NetworkStats> {
  try {
    console.log('[CLIENT] Fetching network stats via wallet UserClient');

    // Get user client for network operations
    if (!window.keeta) {
      throw new Error('Wallet extension not available');
    }
    const userClient = await window.keeta.getUserClient?.();
    if (!userClient) {
      throw new Error('Wallet getUserClient() returned null/undefined');
    }

    const lowClient = (userClient as any)?.client;
    if (!lowClient) {
      console.warn('[CLIENT] Wallet UserClient.client is not available');
      return {
        blockCount: 0,
        transactionCount: 0,
        representativeCount: 0,
        queryTime: 0,
        time: new Date().toISOString(),
      } satisfies NetworkStats;
    }

    const now = typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => Date.now();
    const t0 = now();

    let ledgerStats: any | null = null;
    try {
      if (typeof lowClient.getNodeStats === 'function') {
        const nodeStats = await lowClient.getNodeStats();
        ledgerStats = nodeStats?.ledger ?? null;
        console.debug('[CLIENT] Wallet lowClient.getNodeStats().ledger:', ledgerStats);
      } else if (typeof lowClient.getNetworkStatus === 'function') {
        const status = await lowClient.getNetworkStatus(2000);
        const firstOnline = Array.isArray(status) ? status.find((s: any) => s?.online) : null;
        ledgerStats = firstOnline?.ledger ?? null;
        console.debug('[CLIENT] Wallet lowClient.getNetworkStatus() -> ledger (first online):', ledgerStats);
      } else {
        console.warn('[CLIENT] Wallet low-level client lacks getNodeStats/getNetworkStatus');
      }
    } catch (inner) {
      console.warn('[CLIENT] Error calling wallet low-level network stats:', inner);
    }

    const t1 = now();
    const result = ledgerStats && typeof ledgerStats === 'object'
      ? {
          blockCount: Number(ledgerStats.blockCount ?? 0),
          transactionCount: Number(ledgerStats.transactionCount ?? 0),
          representativeCount: Number(ledgerStats.representativeCount ?? 0),
          queryTime: Math.max(0, Math.round(t1 - t0)),
          time: String(ledgerStats.moment ?? new Date().toISOString()),
        }
      : {
          blockCount: 0,
          transactionCount: 0,
          representativeCount: 0,
          queryTime: Math.max(0, Math.round(t1 - t0)),
          time: new Date().toISOString(),
        };

    console.debug('[CLIENT] Mapped wallet network stats:', result);

    const parsed = walletNetworkStatsSchema.safeParse(result);
    if (!parsed.success) {
      console.error('[CLIENT] Wallet network stats schema validation failed:', parsed.error);
      return {
        blockCount: 0,
        transactionCount: 0,
        representativeCount: 0,
        queryTime: result.queryTime,
        time: result.time,
      } satisfies NetworkStats;
    }

    if (parsed.data.blockCount === 0 && parsed.data.transactionCount === 0 && parsed.data.representativeCount === 0) {
      console.warn('[CLIENT] Wallet network stats are zeroed; representatives may be unreachable');
    }

    return parsed.data;
  } catch (error) {
    console.error('[CLIENT] Error fetching network stats from wallet:', error);
    console.warn('[CLIENT] Falling back to zeroed network stats due to error');
    return {
      blockCount: 0,
      transactionCount: 0,
      representativeCount: 0,
      queryTime: 0,
      time: new Date().toISOString(),
    } satisfies NetworkStats;
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

    const normAddr = (v: any): string => {
      if (typeof v === 'string') return v;
      try {
        if (v?.publicKeyString && typeof v.publicKeyString === 'string') return v.publicKeyString;
        if (v?.publicKeyString?.get) {
          const got = v.publicKeyString.get();
          if (typeof got === 'string') return got;
          if (got?.toString) {
            const s = String(got.toString());
            if (s && s !== '[object Object]') return s;
          }
        }
        if (v?.publicKeyString?.toString) {
          const s = String(v.publicKeyString.toString());
          if (s && s !== '[object Object]') return s;
        }
        if (v?.toString) {
          const s = String(v.toString());
          if (s && s !== '[object Object]') return s;
        }
      } catch {}
      return '';
    };
    const normType = (t: any): string => {
      const map: Record<number, string> = {
        0: 'SEND',
        1: 'RECEIVE',
        2: 'SWAP',
        3: 'SWAP_FORWARD',
        4: 'TOKEN_ADMIN_SUPPLY',
        5: 'TOKEN_ADMIN_MODIFY_BALANCE',
      };
      if (typeof t === 'number' && t in map) return map[t];
      if (typeof t === 'string') {
        const n = Number(t);
        if (Number.isInteger(n) && n in map) return map[n];
        return t.toUpperCase();
      }
      return 'UNKNOWN';
    };
    const normAmt = (a: any): string => {
      if (typeof a === 'bigint') return a.toString();
      if (typeof a === 'number') return String(Math.trunc(a));
      if (typeof a === 'string') return a;
      return '0';
    };

    // Transform wallet history to frontend format
    const stapleOperations = historyResult.records?.map((record: any) => {
      const type = normType(record.operationType ?? record.type);
      const from = normAddr(record.from);
      const to = normAddr(record.to);
      const token = normAddr(record.token);
      const amount = normAmt(record.amount);
      const hash = typeof record.block === 'string' ? record.block : (typeof record.id === 'string' ? record.id : '');
      const tsRaw = (record.timestamp ?? record.date ?? record.blockTimestamp ?? null);
      const date = tsRaw ? new Date(tsRaw).toISOString() : '1970-01-01T00:00:00.000Z';
      const account = query.publicKey || '';
      return {
        type,
        voteStapleHash: hash,
        toAccount: to,
        from,
        to,
        amount,
        token,
        tokenAddress: token,
        tokenMetadata: record.tokenMetadata,
        block: {
          $hash: hash,
          date,
          account,
        },
        operation: { type, from, to, amount, token },
        operationSend: type === 'SEND' ? { from, to, amount, token } : undefined,
        operationReceive: type === 'RECEIVE' ? { from, to, amount, token } : undefined,
      };
    }) || [];
    
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
