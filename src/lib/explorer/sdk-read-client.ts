"use client";
import { z } from 'zod';
import { extractDecimalsAndFieldType, formatAmountWithCommas, formatTokenAmount, getTokenTicker } from '@/app/lib/token-utils';
import { normalizeTokenAddress, normalizeStorageAddress } from '@/lib/explorer/token-address';

// Best-effort normalization of an account-like object into a string public key
function normalizeAccountAddress(candidate: unknown): string | undefined {
  if (!candidate) return undefined;
  if (typeof candidate === 'string') {
    const t = candidate.trim();
    return t.length > 0 ? t : undefined;
  }
  try {
    const pk = (candidate as any)?.publicKeyString;
    if (typeof pk === 'string' && pk.trim().length > 0) return pk.trim();
    if (pk && typeof pk.toString === 'function') {
      const s = String(pk.toString()).trim();
      if (s && s !== '[object Object]') return s;
    }
  } catch {}
  if (typeof (candidate as { toString?: () => string }).toString === 'function') {
    try {
      const s = String((candidate as { toString: () => string }).toString()).trim();
      if (s && s !== '[object Object]') return s;
    } catch {}
  }
  return undefined;
}

async function loadKeeta(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('Keeta SDK is only available in the browser');
  }
  try {
    // Use native dynamic import so the bundler rewrites the specifier correctly
    const mod = await import('@keetanetwork/keetanet-client');
    return mod;
  } catch (e) {
    throw e;
  }
}

const NetworkNameSchema = z.union([z.literal('test'), z.literal('main')]);

function readPreferredNetworkFromLS(): 'test' | 'main' | null {
  try {
    if (typeof window === 'undefined' || !('localStorage' in window)) return null;
    const raw = window.localStorage.getItem('keeta.network');
    if (!raw) return null;
    const parsed = NetworkNameSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function setPreferredNetwork(value: 'test' | 'main'): void {
  try {
    if (typeof window === 'undefined' || !('localStorage' in window)) return;
    window.localStorage.setItem('keeta.network', value);
    cachedClient = null;
    cachedNetwork = null;
  } catch {}
}

export function getPreferredNetwork(): 'test' | 'main' {
  const fromLs = readPreferredNetworkFromLS();
  if (fromLs) return fromLs;
  const env = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_KEETA_NETWORK) || 'test';
  const parsed = NetworkNameSchema.safeParse(env);
  return parsed.success ? parsed.data : 'test';
}

function getNetwork(): 'test' | 'main' {
  return getPreferredNetwork();
}

let cachedClient: any | null = null;
let cachedNetwork: 'test' | 'main' | null = null;
let lastHistoryClientSource: 'wallet' | 'read' = 'read';

type TokenMetadataRecord = {
  metadata?: string | null;
  decimals?: number;
  fieldType?: 'decimalPlaces' | 'decimals';
  name?: string;
  ticker?: string;
};

const tokenMetadataCache = new Map<string, TokenMetadataRecord | null>();
const tokenMetadataPromises = new Map<string, Promise<TokenMetadataRecord | null>>();

// LocalStorage cache (client-side only)
const LS_KEY = 'keeta.tokenMetadata';
const LsEntrySchema = z
  .object({
    metadata: z.string().nullable().optional(),
    decimals: z.number().optional(),
    fieldType: z.enum(['decimalPlaces', 'decimals']).optional(),
    name: z.string().optional(),
    ticker: z.string().optional(),
    updatedAt: z.number().optional(),
  })
  .partial();
const LsStoreSchema = z.record(z.string(), LsEntrySchema);

function readTokenMetadataFromLS(token: string): TokenMetadataRecord | null {
  try {
    if (typeof window === 'undefined' || !('localStorage' in window)) return null;
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const res = LsStoreSchema.safeParse(parsed);
    if (!res.success) return null;
    const entry = (res.data as Record<string, z.infer<typeof LsEntrySchema>>)[token];
    if (!entry) return null;
    return {
      metadata: typeof entry.metadata === 'string' || entry.metadata === null ? entry.metadata : undefined,
      decimals: typeof entry.decimals === 'number' ? entry.decimals : undefined,
      fieldType: entry.fieldType,
      name: entry.name,
      ticker: entry.ticker,
    };
  } catch {
    return null;
  }
}

function writeTokenMetadataToLS(token: string, record: TokenMetadataRecord): void {
  try {
    if (typeof window === 'undefined' || !('localStorage' in window)) return;
    const raw = window.localStorage.getItem(LS_KEY);
    let store: Record<string, any> = {};
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const res = LsStoreSchema.safeParse(parsed);
        if (res.success) store = res.data as Record<string, any>;
      } catch {}
    }
    store[token] = { ...store[token], ...record, updatedAt: Date.now() };
    window.localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {}
}

function getCachedTokenMetadata(token: string): TokenMetadataRecord | null | undefined {
  if (tokenMetadataCache.has(token)) {
    return tokenMetadataCache.get(token) ?? null;
  }
  // Fallback to LS
  const fromLs = readTokenMetadataFromLS(token);
  if (fromLs) {
    tokenMetadataCache.set(token, fromLs);
    return fromLs;
  }
  return undefined;
}

async function fetchTokenMetadataWithCache(
  client: any,
  KeetaNet: any,
  tokenAddress: string,
): Promise<TokenMetadataRecord | null> {
  const cached = getCachedTokenMetadata(tokenAddress);
  if (cached !== undefined) {
    return cached;
  }

  if (tokenMetadataPromises.has(tokenAddress)) {
    return tokenMetadataPromises.get(tokenAddress)!;
  }

  const promise = (async () => {
    try {
      let lookupAddress = tokenAddress;
      let tokenAccount: any;
      try {
        tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(lookupAddress);
      } catch (initialError) {
        const converted = await normalizeTokenAddress(lookupAddress);
        if (!converted) {
          return null;
        }
        lookupAddress = converted;
        tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(lookupAddress);
      }

      const tokenState = await client.state({ account: tokenAccount });
      const info = tokenState?.info ?? {};
      const metadata = typeof info?.metadata === 'string' ? info.metadata : undefined;
      let decimals: number | undefined;
      let fieldType: 'decimalPlaces' | 'decimals' | undefined;
      if (metadata) {
        try {
          const decInfo = extractDecimalsAndFieldType(metadata);
          decimals = decInfo.decimals;
          fieldType = decInfo.fieldType;
        } catch {}
      }
      const desc = typeof (info as any)?.description === 'string' ? (info as any).description : undefined;
      const nm = typeof (info as any)?.name === 'string' ? (info as any).name : undefined;
      const tkSym = typeof (info as any)?.symbol === 'string' ? (info as any).symbol : undefined;
      const tkTicker = typeof (info as any)?.ticker === 'string' ? (info as any).ticker : undefined;
      const tkCode = typeof (info as any)?.currencyCode === 'string' ? (info as any).currencyCode : undefined;
      const derivedTicker = metadata ? getTokenTicker(metadata) : undefined;
      const ticker = (tkSym || tkTicker || tkCode || derivedTicker || nm)
        ?.toString()
        .trim()
        .toUpperCase();
      const record: TokenMetadataRecord = {
        metadata: metadata ?? null,
        decimals,
        fieldType,
        name: (desc && desc.trim().length > 0) ? desc : nm,
        ticker: ticker && ticker.length > 0 ? ticker : undefined,
      };
      // Persist to localStorage cache
      try { writeTokenMetadataToLS(lookupAddress, record); } catch {}
      return record;
    } catch (e) {
      return null;
    }
  })().finally(() => {
    tokenMetadataPromises.delete(tokenAddress);
  });

  tokenMetadataPromises.set(tokenAddress, promise);
  const resolved = await promise;
  tokenMetadataCache.set(tokenAddress, resolved);
  return resolved;
}

export async function getTokenMetadataRecord(tokenAddress: string): Promise<TokenMetadataRecord | null> {
  const KeetaNet = await loadKeeta();
  const client = await getReadClient();
  return fetchTokenMetadataWithCache(client, KeetaNet, tokenAddress);
}

export async function getReadClient(): Promise<any> {
  const desiredNetwork = getNetwork();
  if (cachedClient && cachedNetwork === desiredNetwork) {
    return cachedClient;
  }

  const KeetaNet = await loadKeeta();
  const seed = KeetaNet.lib.Account.generateRandomSeed({ asString: true });
  const account = KeetaNet.lib.Account.fromSeed(seed, 0);
  const network = desiredNetwork;

  let client: any;
  if (typeof (KeetaNet as any).UserClient?.fromNetwork === 'function') {
    client = (KeetaNet as any).UserClient.fromNetwork(network, account);
  } else if (typeof (KeetaNet as any).UserClient === 'function') {
    client = new (KeetaNet as any).UserClient({ network, account });
  } else {
    throw new Error('Keeta SDK UserClient not available');
  }

  cachedClient = client;
  cachedNetwork = desiredNetwork;
  return client;
}
 
async function getClientForHistory(): Promise<any> {
  try {
    if (typeof window !== 'undefined') {
      const w = window as any;
      const hasKeeta = Boolean(w?.keeta);
      const hasGetUserClient = hasKeeta && typeof w.keeta.getUserClient === 'function';
      if (hasGetUserClient) {
        const c = await w.keeta.getUserClient();
        if (c) {
          lastHistoryClientSource = 'wallet';
          return c;
        }
      }
    }
  } catch {}
  lastHistoryClientSource = 'read';
  return getReadClient();
}

export async function getHistory(options?: { depth?: number; cursor?: string | null; accountPublicKey?: string }): Promise<unknown> {
  try {
    const KeetaNet = await loadKeeta();
    const client = await getClientForHistory();
    const query: Record<string, unknown> = {};
    if (options?.depth != null) query.depth = Math.max(1, Math.min(options.depth, 100));
    if (options?.cursor) (query as any).startBlocksHash = options.cursor;
    if (options?.accountPublicKey) {
      try {
        (query as any).account = KeetaNet.lib.Account.fromPublicKeyString(options.accountPublicKey);
      } catch {}
    }

    if (typeof client.history === 'function') {
      let res = await client.history(query);
      const inspect = (value: unknown) => {
        // Inspection removed - no logging
      };
      inspect(res);
      if (!Array.isArray(res) && res && typeof res === 'object') {
        const containerKeys = ['records', 'history', 'voteStaples', 'items', 'data'];
        for (const key of containerKeys) {
          const candidate = (res as Record<string, unknown>)[key];
          if (Array.isArray(candidate)) {
            res = candidate;
            inspect(res);
            break;
          }
        }
      }
      if ((!Array.isArray(res) || res.length === 0) && (query as any).account) {
        try {
          const { account, ...rest } = query as any;
          let res2: unknown = await client.history(rest);
          inspect(res2);
          if (!Array.isArray(res2) && res2 && typeof res2 === 'object') {
            const containerKeys = ['records', 'history', 'voteStaples', 'items', 'data'];
            for (const key of containerKeys) {
              const candidate = (res2 as Record<string, unknown>)[key];
              if (Array.isArray(candidate)) {
                res2 = candidate;
                inspect(res2);
                break;
              }
            }
          }
          res = Array.isArray(res2) ? (res2 as any[]) : [];
        } catch {}
      }
      if (!Array.isArray(res) || res.length === 0) {
        try {
          const rc = await getReadClient();
          let resR: unknown = await rc.history(query as any);
          inspect(resR);
          if (!Array.isArray(resR) && resR && typeof resR === 'object') {
            const containerKeys = ['records', 'history', 'voteStaples', 'items', 'data'];
            for (const key of containerKeys) {
              const candidate = (resR as Record<string, unknown>)[key];
              if (Array.isArray(candidate)) {
                resR = candidate;
                inspect(resR);
                break;
              }
            }
          }
          if ((!Array.isArray(resR) || (Array.isArray(resR) && resR.length === 0)) && (query as any).account) {
            try {
              const { account, ...rest } = query as any;
              let resR2: unknown = await rc.history(rest);
              inspect(resR2);
              if (!Array.isArray(resR2) && resR2 && typeof resR2 === 'object') {
                const containerKeys = ['records', 'history', 'voteStaples', 'items', 'data'];
                for (const key of containerKeys) {
                  const candidate = (resR2 as Record<string, unknown>)[key];
                  if (Array.isArray(candidate)) {
                    resR2 = candidate;
                    inspect(resR2);
                    break;
                  }
                }
              }
              resR = Array.isArray(resR2) ? resR2 : [];
            } catch {}
          }
          if (Array.isArray(resR) && resR.length > 0) {
            res = resR as any[];
          }
        } catch {}
      }
      return res;
    }
    return [];
  } catch (e) {
    return [];
  }
}

export async function getAccountState(publicKey: string): Promise<unknown | null> {
  try {
    const KeetaNet = await loadKeeta();
    const client = await getReadClient();
    const account = KeetaNet.lib.Account.fromPublicKeyString(publicKey);

    if (typeof client.state === 'function') {
      const res = await client.state({ account });
      return res;
    }
    if (typeof client.account === 'function') {
      const res = await client.account(publicKey);
      return res;
    }
    if (typeof client.getAccount === 'function') {
      const res = await client.getAccount(publicKey);
      return res;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export async function getNormalizedBalancesForAccount(accountPublicKey: string): Promise<Array<{
  token: string;
  balance: string;
  name?: string;
  ticker?: string;
  decimals?: number;
  fieldType?: 'decimalPlaces' | 'decimals';
  formattedAmount?: string;
}>> {
  try {
    const KeetaNet = await loadKeeta();
    const state = await getAccountState(accountPublicKey);
    const entries: any[] = Array.isArray((state as any)?.balances)
      ? (state as any).balances
      : Array.isArray((state as any)?.tokens)
        ? (state as any).tokens
        : [];

    if (!entries.length) return [];

    const client = await getReadClient();

    const toStringSafe = (value: unknown): string => {
      if (typeof value === 'string') return value;
      if (typeof value === 'number') return Math.trunc(value).toString();
      if (typeof value === 'bigint') return value.toString();
      if (value && typeof (value as { toString?: () => string }).toString === 'function') {
        return String((value as { toString: () => string }).toString());
      }
      return '';
    };

    const results: Array<{
      token: string;
      balance: string;
      name?: string;
      ticker?: string;
      decimals?: number;
      fieldType?: 'decimalPlaces' | 'decimals';
      formattedAmount?: string;
    }> = [];

    for (const entry of entries) {
      const tokenAddr = toStringSafe(entry?.token ?? entry?.publicKey);
      if (!tokenAddr) continue;
      const rawBalance = toStringSafe(entry?.balance ?? entry?.amount ?? '0');

      let name: string | undefined;
      let ticker: string | undefined;
      let decimals: number | undefined;
      let fieldType: 'decimalPlaces' | 'decimals' | undefined;
      let formattedAmount: string | undefined;

      try {
        const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(tokenAddr);
        const tokenState = typeof client.state === 'function' ? await client.state({ account: tokenAccount }) : null;
        const info = tokenState?.info ?? {};
        const metadata = typeof info?.metadata === 'string' ? info.metadata : undefined;
        const decimalInfo = extractDecimalsAndFieldType(metadata);
        decimals = decimalInfo.decimals;
        fieldType = decimalInfo.fieldType;
        name = typeof info?.name === 'string' ? info.name : undefined;
        ticker = typeof (info?.ticker ?? info?.symbol) === 'string' ? (info?.ticker ?? info?.symbol) : undefined;
        try {
          const formatted = formatTokenAmount(rawBalance, decimals, fieldType);
          formattedAmount = formatAmountWithCommas(formatted);
        } catch {
          formattedAmount = undefined;
        }
      } catch {
        // metadata lookup best-effort
      }

      results.push({ token: tokenAddr, balance: rawBalance, name, ticker, decimals, fieldType, formattedAmount });
    }

    return results;
  } catch (e) {
    return [];
  }
}

export async function getBlock(hash: string): Promise<unknown | null> {
  try {
    const client = await getReadClient();
    if (typeof client.block === 'function') {
      return await client.block(hash);
    }
    return null;
  } catch {
    return null;
  }
}

export async function listStorageAccountsByOwner(ownerPublicKey: string): Promise<Array<{ principal?: string; entity?: string; target?: string; permissions?: string[] }>> {
  try {
    const KeetaNet = await loadKeeta();
    const client = await getReadClient();
    const owner = KeetaNet.lib.Account.fromPublicKeyString(ownerPublicKey);

    if (typeof client.listACLsByPrincipal !== 'function') {
      return [];
    }

    let entries = await client.listACLsByPrincipal([owner]);
    if (!entries || (Array.isArray(entries) && entries.length === 0)) {
      try {
        // Some client versions expect an object shape: { account }
        entries = await client.listACLsByPrincipal({ account: owner });
      } catch (e) {
        // ignore
      }
    }
    const results: Array<{ principal?: string; entity?: string; target?: string; permissions?: string[] }> = [];

    const toAccountString = (value: unknown): string | undefined => {
      if (typeof value === 'string') return value;
      try {
        if (value && typeof (value as { publicKeyString?: string }).publicKeyString === 'string') {
          return (value as { publicKeyString: string }).publicKeyString;
        }
        const maybePK = (value as { publicKeyString?: { toString?: () => string } }).publicKeyString;
        if (maybePK && typeof maybePK.toString === 'function') {
          const coerced = String(maybePK.toString());
          if (coerced && coerced !== '[object Object]') return coerced;
        }
        if (value && typeof (value as { toString?: () => string }).toString === 'function') {
          const coerced = String((value as { toString: () => string }).toString());
          if (coerced && coerced !== '[object Object]') return coerced;
        }
      } catch {
        // ignore
      }
      return undefined;
    };

    if (Array.isArray(entries)) {
      for (const acl of entries) {
        try {
          const entity = (acl as any).entity;
          const rawPerms = (acl as any).permissions;
          const permissions: string[] = Array.isArray(rawPerms)
            ? rawPerms.map((p: unknown) => (typeof p === 'string' ? p : String(p)))
            : Array.isArray(rawPerms?.base?.flags)
              ? (rawPerms.base.flags as unknown[]).map((p: unknown) => (typeof p === 'string' ? p : String(p)))
              : [];
          const isStorage =
            (typeof entity?.isStorage === 'function' ? Boolean(entity.isStorage()) : false) ||
            permissions.some((p) => typeof p === 'string' && p.toUpperCase().startsWith('STORAGE_'));
          if (!isStorage) {
            continue;
          }

          const principalS = toAccountString((acl as any).principal);
          const entityS = toAccountString((acl as any).entity);
          const targetS = toAccountString((acl as any).target);
          results.push({ principal: principalS, entity: entityS, target: targetS, permissions });
        } catch (e) {
          // skip malformed entry
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

const BIG_INT_ZERO = BigInt(0);

const toBigInt = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? BigInt(trimmed) : BIG_INT_ZERO;
  }
  if (value && typeof (value as { toString?: () => string }).toString === 'function') {
    const coerced = String((value as { toString: () => string }).toString()).trim();
    return coerced && coerced !== '[object Object]' ? BigInt(coerced) : BIG_INT_ZERO;
  }
  return BIG_INT_ZERO;
};

export async function getAggregatedBalancesForOwner(
  ownerPublicKey: string,
  opts?: { maxStorages?: number; includeTokenMetadata?: boolean },
): Promise<Array<{ token: string; balance: string; metadata?: string; decimals?: number; name?: string; ticker?: string }>> {
  try {
    const KeetaNet = await loadKeeta();
    const client = await getReadClient();
    const includeTokenMetadata = opts?.includeTokenMetadata ?? true;
    const maxStorages = Math.max(0, Math.min(opts?.maxStorages ?? 25, 200));

    const totals = new Map<string, { balance: bigint; metadata?: string; decimals?: number; name?: string; ticker?: string }>();
    const upsert = (token: string, amount: bigint, metadata?: string, decimals?: number, name?: string, ticker?: string) => {
      const previous = totals.get(token);
      const balance = (previous?.balance ?? BIG_INT_ZERO) + amount;
      const meta = previous?.metadata ?? metadata;
      const dec = typeof previous?.decimals === 'number' ? previous!.decimals : decimals;
      const nm = (previous?.name && previous.name.trim().length > 0) ? previous.name : name;
      const tk = (previous?.ticker && previous.ticker.trim().length > 0) ? previous.ticker : ticker;
      totals.set(token, { balance, metadata: meta, decimals: dec, name: nm, ticker: tk });
    };

    const tokensRequiringMetadata = new Set<string>();

    try {
      const ownerAccount = KeetaNet.lib.Account.fromPublicKeyString(ownerPublicKey);
      const ownerState = await client.state({ account: ownerAccount });
      const balances: any[] = Array.isArray(ownerState?.balances) ? ownerState.balances : [];
      for (const entry of balances) {
        let tokenAddr = normalizeAccountAddress((entry as any)?.token ?? (entry as any)?.publicKey) ?? '';
        if (!tokenAddr) continue;

        // Convert hex addresses to keeta_ format for proper metadata lookup
        if (!tokenAddr.startsWith('keeta_')) {
          const normalized = await normalizeTokenAddress(tokenAddr);
          if (normalized) {
            tokenAddr = normalized;
          }
        }

        const amount = toBigInt((entry as any)?.balance ?? (entry as any)?.amount);
        let decimals = typeof (entry as any)?.decimals === 'number' ? (entry as any).decimals : undefined;
        let metadata = typeof (entry as any)?.metadata === 'string' ? (entry as any).metadata : undefined;
        let name = typeof (entry as any)?.name === 'string' ? (entry as any).name : undefined;
        let ticker = typeof (entry as any)?.ticker === 'string' ? (entry as any).ticker : undefined;

        if (includeTokenMetadata) {
          const cached = getCachedTokenMetadata(tokenAddr);
          if (cached) {
            metadata = metadata ?? cached.metadata ?? undefined;
            decimals = decimals ?? cached.decimals;
            name = name ?? cached.name ?? undefined;
            ticker = ticker ?? cached.ticker ?? undefined;
          }
          const needsMetadata =
            !cached && (
              !metadata ||
              (typeof metadata === 'string' && metadata.trim().length === 0) ||
              typeof decimals !== 'number' ||
              !name ||
              !ticker
            );
          if (needsMetadata) {
            tokensRequiringMetadata.add(tokenAddr);
          }
        }

        upsert(tokenAddr, amount, metadata, decimals, name, ticker);
      }
    } catch (e) {
      // ignore
    }

    let storages: Array<{ entity?: string }> = [];
    try {
      const acl = await listStorageAccountsByOwner(ownerPublicKey);
      storages = Array.isArray(acl) ? acl.slice(0, maxStorages) : [];
    } catch (e) {
      storages = [];
    }

    const fetchStorage = async (address: string) => {
      try {
        const storageAccount = KeetaNet.lib.Account.fromPublicKeyString(address);
        const storageState = await client.state({ account: storageAccount });
        const balances: any[] = Array.isArray(storageState?.balances) ? storageState.balances : [];

        for (const entry of balances) {
          let tokenAddr = normalizeAccountAddress((entry as any)?.token ?? (entry as any)?.publicKey) ?? '';
          if (!tokenAddr) continue;

          // Convert hex addresses to keeta_ format for proper metadata lookup
          if (!tokenAddr.startsWith('keeta_')) {
            const normalized = await normalizeTokenAddress(tokenAddr);
            if (normalized) {
              tokenAddr = normalized;
            }
          }

          const amount = toBigInt((entry as any)?.balance ?? (entry as any)?.amount);
          let decimals = typeof (entry as any)?.decimals === 'number' ? (entry as any).decimals : undefined;
          let metadata = typeof (entry as any)?.metadata === 'string' ? (entry as any).metadata : undefined;
          let name: string | undefined = typeof (entry as any)?.name === 'string' ? (entry as any).name : undefined;
          let ticker: string | undefined = typeof (entry as any)?.ticker === 'string' ? (entry as any).ticker : undefined;

          if (includeTokenMetadata) {
            const cached = getCachedTokenMetadata(tokenAddr);
            if (cached) {
              metadata = metadata ?? cached.metadata ?? undefined;
              decimals = decimals ?? cached.decimals;
              name = cached.name ?? name;
              ticker = cached.ticker ?? ticker;
            }
            const needsMetadata =
              !cached && (
                !metadata ||
                (typeof metadata === 'string' && metadata.trim().length === 0) ||
                typeof decimals !== 'number' ||
                !name ||
                !ticker
              );
            if (needsMetadata) {
              tokensRequiringMetadata.add(tokenAddr);
            }
          }

          upsert(tokenAddr, amount, metadata, decimals, name, ticker);
        }
      } catch (e) {
        // ignore
      }
    };

    await Promise.allSettled(storages.map((s) => (s.entity ? fetchStorage(s.entity) : Promise.resolve())));

    if (includeTokenMetadata && tokensRequiringMetadata.size > 0) {
      const tokensToResolve = Array.from(tokensRequiringMetadata).filter((token) => getCachedTokenMetadata(token) === undefined);
      if (tokensToResolve.length > 0) {
        const resolved = await Promise.all(tokensToResolve.map((token) => fetchTokenMetadataWithCache(client, KeetaNet, token)));
        resolved.forEach((record, index) => {
          const token = tokensToResolve[index];
          if (!record) {
            return;
          }
          const current = totals.get(token);
          if (!current) {
            return;
          }
          if (!current.metadata && record.metadata) {
            current.metadata = record.metadata ?? undefined;
          }
          if (typeof current.decimals !== 'number' && typeof record.decimals === 'number') {
            current.decimals = record.decimals;
          }
          if ((!current.name || current.name.trim().length === 0) && record.name) {
            current.name = record.name;
          }
          if ((!current.ticker || current.ticker.trim().length === 0) && record.ticker) {
            current.ticker = record.ticker;
          }
          totals.set(token, current);
        });
      }
    }

    const result: Array<{ token: string; balance: string; metadata?: string; decimals?: number; name?: string; ticker?: string }> = [];
    for (const [token, info] of totals.entries()) {
      result.push({ token, balance: info.balance.toString(), metadata: info.metadata, decimals: info.decimals, name: info.name, ticker: info.ticker });
    }
    return result;
  } catch (e) {
    return [];
  }
}

export async function getHistoryForAccount(
  accountPublicKey: string,
  options?: { depth?: number; cursor?: string | null; includeTokenMetadata?: boolean },
): Promise<Array<{
  id: string;
  block?: string;
  timestamp?: number;
  type?: string;
  amount?: string;
  from?: string;
  to?: string;
  token?: string;
  tokenTicker?: string | null;
  tokenDecimals?: number | null;
  tokenMetadata?: { name?: string | null; ticker?: string | null; decimals?: number | null } | null;
}>> {
  try {
    const KeetaNet = await loadKeeta();
    const client = await getClientForHistory();
    const accountObj = KeetaNet.lib.Account.fromPublicKeyString(accountPublicKey);

    const depth = Math.max(1, Math.min(options?.depth ?? 25, 100));
    const query: Record<string, unknown> = { depth };
    if (options?.cursor) (query as any).startBlocksHash = options.cursor;
    (query as any).account = accountObj;

    const inspect = (value: unknown) => {
      // Inspection removed - no logging
    };
    let response: unknown = typeof client.history === 'function' ? await client.history(query) : [];
    inspect(response);
    if (!Array.isArray(response) && response && typeof response === 'object') {
      const containerKeys = ['records', 'history', 'voteStaples', 'items', 'data'];
      for (const key of containerKeys) {
        const candidate = (response as Record<string, unknown>)[key];
        if (Array.isArray(candidate)) {
          response = candidate;
          inspect(response);
          break;
        }
      }
    }
    if ((!Array.isArray(response) || response.length === 0)) {
      try {
        const { account, ...rest } = query as any;
        let fallbackRes: unknown = await client.history(rest);
        inspect(fallbackRes);
        if (!Array.isArray(fallbackRes) && fallbackRes && typeof fallbackRes === 'object') {
          const containerKeys = ['records', 'history', 'voteStaples', 'items', 'data'];
          for (const key of containerKeys) {
            const candidate = (fallbackRes as Record<string, unknown>)[key];
            if (Array.isArray(candidate)) {
              fallbackRes = candidate;
              inspect(fallbackRes);
              break;
            }
          }
        }
        response = Array.isArray(fallbackRes) ? fallbackRes : [];
      } catch {}
      if (!Array.isArray(response) || response.length === 0) {
        try {
          const rc = await getReadClient();
          let resR: unknown = await rc.history(query as any);
          inspect(resR);
          if (!Array.isArray(resR) && resR && typeof resR === 'object') {
            const containerKeys = ['records', 'history', 'voteStaples', 'items', 'data'];
            for (const key of containerKeys) {
              const candidate = (resR as Record<string, unknown>)[key];
              if (Array.isArray(candidate)) {
                resR = candidate;
                inspect(resR);
                break;
              }
            }
          }
          if ((!Array.isArray(resR) || (Array.isArray(resR) && resR.length === 0))) {
            try {
              const { account, ...rest } = query as any;
              let resR2: unknown = await rc.history(rest);
              inspect(resR2);
              if (!Array.isArray(resR2) && resR2 && typeof resR2 === 'object') {
                const containerKeys = ['records', 'history', 'voteStaples', 'items', 'data'];
                for (const key of containerKeys) {
                  const candidate = (resR2 as Record<string, unknown>)[key];
                  if (Array.isArray(candidate)) {
                    resR2 = candidate;
                    inspect(resR2);
                    break;
                  }
                }
              }
              resR = Array.isArray(resR2) ? resR2 : [];
            } catch {}
          }
          if (Array.isArray(resR) && resR.length > 0) {
            response = resR as any[];
          }
        } catch {}
        if (!Array.isArray(response) || response.length === 0) {
          return [];
        }
      }
    }

    // Handle both wrapper objects { voteStaple, effects? } and bare VoteStaple objects
    const voteStaples: any[] = response
      .map((entry) => (entry && typeof entry === 'object' && 'voteStaple' in entry ? (entry as any).voteStaple : entry))
      .filter((v) => Boolean(v));
    if (voteStaples.length === 0) {
      return [];
    }

    let filtered: Record<string, Array<{ block: any; filteredOperations: any[] }>> = {};
    let filterStapleOperationsWorked = false;
    try {
      if (typeof client.filterStapleOperations === 'function') {
        // Prefer passing account context so only relevant ops are returned
        const ctx = { account: accountObj } as any;
        const result = client.filterStapleOperations(voteStaples, ctx);
        filtered = (await Promise.resolve(result)) as typeof filtered;
        // Check if filterStapleOperations actually returned meaningful results
        if (filtered && typeof filtered === 'object' && Object.keys(filtered).length > 0) {
          // Verify that at least one entry has filteredOperations
          const hasOperations = Object.values(filtered).some((blocks) => 
            Array.isArray(blocks) && blocks.some((b: any) => 
              Array.isArray(b?.filteredOperations) && b.filteredOperations.length > 0
            )
          );
          filterStapleOperationsWorked = hasOperations;
        }
      } else if (typeof client.filterStapleOps === 'function') {
        const ctx = { account: accountObj } as any;
        const result = client.filterStapleOps(voteStaples, ctx);
        filtered = (await Promise.resolve(result)) as typeof filtered;
        // Check if filterStapleOps actually returned meaningful results
        if (filtered && typeof filtered === 'object' && Object.keys(filtered).length > 0) {
          const hasOperations = Object.values(filtered).some((blocks) => 
            Array.isArray(blocks) && blocks.some((b: any) => 
              Array.isArray(b?.filteredOperations) && b.filteredOperations.length > 0
            )
          );
          filterStapleOperationsWorked = hasOperations;
        }
      }
    } catch (filterError) {
      // filterStapleOperations failed, will use manual extraction
      filterStapleOperationsWorked = false;
    }

    const normalizeAddress = (candidate: unknown): string | undefined => {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }
      try {
        const normalized = (candidate && (candidate as any).publicKeyString)
          ? String((candidate as any).publicKeyString)
          : undefined;
        if (normalized && normalized.trim().length > 0) return normalized.trim();
      } catch {}
      if (candidate && typeof candidate === 'object' && typeof (candidate as { toString?: () => string }).toString === 'function') {
        try {
          const coerced = (candidate as { toString: () => string }).toString();
          const trimmed = coerced?.trim?.() ?? '';
          if (trimmed && trimmed !== '[object Object]') return trimmed;
        } catch {}
      }
      return undefined;
    };

    // Normalize the account public key for consistent comparison
    const normalizedAccountPublicKey = normalizeAddress(accountPublicKey) ?? accountPublicKey.trim();
    
    // Helper to check if an address matches the account (handles both hex and keeta_ formats)
    const addressMatchesAccount = (addr: string | undefined): boolean => {
      if (!addr) return false;
      const normalizedAddr = addr.trim();
      if (normalizedAddr === normalizedAccountPublicKey) return true;
      // Also check if addresses match when normalized (handles hex vs keeta_ format differences)
      // For now, do exact match - if needed, we can add hex/keeta conversion here
      return false;
    };

    const results: Array<{
      id: string;
      block?: string;
      timestamp?: number;
      type?: string;
      amount?: string;
      from?: string;
      to?: string;
      token?: string;
      tokenTicker?: string | null;
      tokenDecimals?: number | null;
      tokenMetadata?: { name?: string | null; ticker?: string | null; decimals?: number | null } | null;
    }> = [];

    const includeTokenMetadata = options?.includeTokenMetadata ?? false;
    const tokensRequiringMetadata = new Set<string>();

    type PendingOperation = {
      id: string;
      block?: string;
      timestamp?: number;
      type?: string;
      amount?: string;
      from?: string;
      to?: string;
      token?: string;
      tokenTicker?: string | null;
      tokenDecimals?: number | null;
      tokenMetadata?: { name?: string | null; ticker?: string | null; decimals?: number | null } | null;
    };

    const pending: PendingOperation[] = [];

    // If filter API returned results, use them; otherwise derive from staple blocks directly
    const hasFiltered = filterStapleOperationsWorked && filtered && Object.keys(filtered).length > 0;
    if (hasFiltered) {
      for (const [stapleHash, blocks] of Object.entries(filtered)) {
        for (const { block, filteredOperations } of blocks) {
          // Skip if no filtered operations
          if (!Array.isArray(filteredOperations) || filteredOperations.length === 0) {
            continue;
          }
          
          const blockTimestamp = block?.date instanceof Date ? block.date.getTime() : Date.now();
          const blockHash = typeof block?.hash?.toString === 'function' ? block.hash.toString() : undefined;
          const blockAccount = normalizeAddress(block?.account) ?? '';

          for (const operation of filteredOperations) {
            const type = String((operation as any)?.type ?? 'UNKNOWN');
            const amountRaw = (operation as any)?.amount;
            const amount = typeof amountRaw === 'bigint'
              ? amountRaw.toString()
              : typeof amountRaw === 'number'
                ? Math.trunc(amountRaw).toString()
                : typeof amountRaw === 'string'
                  ? amountRaw
                  : undefined;

            const from = normalizeAddress((operation as any).from) ?? blockAccount;
            const to = normalizeAddress((operation as any).to) ?? blockAccount;
            const token = normalizeAddress((operation as any).token
              ?? (operation as any).tokenAddress
              ?? (operation as any).account
              ?? (operation as any).target
              ?? (operation as any).asset
              ?? (operation as any).currency);

            // When filterStapleOperations returns results, they should already be filtered for the account.
            // We trust filterStapleOperations results and only do a light verification.
            // For keyed accounts, operations typically have the account in 'from', 'to', or 'blockAccount'
            const operationTarget = normalizeAddress((operation as any).target 
              ?? (operation as any).entity
              ?? (operation as any).account);
            
            // Since filterStapleOperations already filtered these operations for the account,
            // we trust them completely and don't do additional filtering.
            // filterStapleOperations is designed to return only operations relevant to the account,
            // so if it returned this operation, it's relevant.
            // This is especially important for keyed accounts where filterStapleOperations should work correctly.

            let record: TokenMetadataRecord | null | undefined;
            if (includeTokenMetadata && token) {
              record = getCachedTokenMetadata(token);
              if (record === undefined) {
                tokensRequiringMetadata.add(token);
              }
            }

            pending.push({
              id: blockHash || `${stapleHash}:${type}:${from ?? ''}:${to ?? ''}`,
              block: blockHash,
              timestamp: blockTimestamp,
              type,
              amount: amount ?? '0',
              from: from ?? '',
              to: to ?? '',
              token: token ?? '',
              tokenTicker: record && record.ticker ? record.ticker : null,
              tokenDecimals: record && typeof record.decimals === 'number' ? record.decimals : null,
              tokenMetadata: record
                ? {
                    name: record.name ?? null,
                    ticker: record.ticker ?? null,
                    decimals: record.decimals ?? null,
                  }
                : null,
            });
          }
        }
      }
    } else {
      // Manual extraction from staple blocks when filter API is unavailable
      for (const staple of voteStaples as any[]) {
        const stapleHash = typeof (staple?.hash?.toString) === 'function' ? staple.hash.toString() : undefined;
        const blocks = Array.isArray(staple?.blocks) ? staple.blocks : [];
        for (const block of blocks as any[]) {
          const ops = Array.isArray(block?.operations) ? block.operations : Array.isArray(block?.transactions) ? block.transactions : [];
          const blockTimestamp = block?.date instanceof Date ? block.date.getTime() : Date.now();
          const blockHash = typeof block?.hash?.toString === 'function' ? block.hash.toString() : stapleHash;
          const blockAccount = normalizeAddress(block?.account) ?? '';
          for (const operation of ops) {
            const type = String((operation as any)?.type ?? 'UNKNOWN');
            const amountRaw = (operation as any)?.amount;
            const amount = typeof amountRaw === 'bigint'
              ? amountRaw.toString()
              : typeof amountRaw === 'number'
                ? Math.trunc(amountRaw).toString()
                : typeof amountRaw === 'string'
                  ? amountRaw
                  : undefined;
            const from = normalizeAddress((operation as any).from) ?? blockAccount;
            const to = normalizeAddress((operation as any).to) ?? blockAccount;
            const token = normalizeAddress((operation as any).token
              ?? (operation as any).tokenAddress
              ?? (operation as any).account
              ?? (operation as any).target
              ?? (operation as any).asset
              ?? (operation as any).currency);
            
            // For storage accounts, check additional fields that might reference the storage account
            // Storage account operations might have the storage account as 'target', 'entity', or 'account'
            const operationTarget = normalizeAddress((operation as any).target 
              ?? (operation as any).entity
              ?? (operation as any).account);
            
            // Check if this operation affects the account (from, to, block account, or operation target/entity)
            // Use normalized comparison to handle address format differences
            const affectsAccount = addressMatchesAccount(from) 
              || addressMatchesAccount(to) 
              || addressMatchesAccount(blockAccount)
              || addressMatchesAccount(operationTarget)
              || from === normalizedAccountPublicKey
              || to === normalizedAccountPublicKey
              || blockAccount === normalizedAccountPublicKey
              || (operationTarget && operationTarget === normalizedAccountPublicKey);

            if (!affectsAccount) {
              continue;
            }
            pending.push({
              id: blockHash || `${stapleHash}:${type}:${from ?? ''}:${to ?? ''}`,
              block: blockHash,
              timestamp: blockTimestamp,
              type,
              amount: amount ?? '0',
              from: from ?? '',
              to: to ?? '',
              token: token ?? '',
              tokenTicker: null,
              tokenDecimals: null,
              tokenMetadata: null,
            });
          }
        }
      }
    }

    if (includeTokenMetadata && tokensRequiringMetadata.size > 0) {
      const tokensToResolve = Array.from(tokensRequiringMetadata);
      const resolved = await Promise.all(tokensToResolve.map((token) => fetchTokenMetadataWithCache(client, KeetaNet, token)));
      const resolvedMap = new Map<string, TokenMetadataRecord | null>();
      resolved.forEach((value, index) => {
        resolvedMap.set(tokensToResolve[index], value);
      });

      for (const op of pending) {
        if (!op.token) continue;
        if (!resolvedMap.has(op.token)) continue;
        const record = resolvedMap.get(op.token);
        if (!record) {
          op.tokenTicker = op.tokenTicker ?? null;
          op.tokenDecimals = op.tokenDecimals ?? null;
          op.tokenMetadata = op.tokenMetadata ?? null;
          continue;
        }
        if (!op.tokenTicker && record.ticker) {
          op.tokenTicker = record.ticker;
        }
        if (typeof op.tokenDecimals !== 'number' && typeof record.decimals === 'number') {
          op.tokenDecimals = record.decimals;
        }
        const nextMetadata = op.tokenMetadata ?? { name: null, ticker: null, decimals: null };
        if (!nextMetadata.name && record.name) {
          nextMetadata.name = record.name;
        }
        if (!nextMetadata.ticker && record.ticker) {
          nextMetadata.ticker = record.ticker;
        }
        if (nextMetadata.decimals == null && typeof record.decimals === 'number') {
          nextMetadata.decimals = record.decimals;
        }
        op.tokenMetadata = nextMetadata;
      }
    }

    results.push(...pending);
    results.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    return results;
  } catch (e) {
    return [];
  }
}
