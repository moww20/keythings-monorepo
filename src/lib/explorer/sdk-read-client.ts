"use client";
import { z } from 'zod';
import { extractDecimalsAndFieldType, formatAmountWithCommas, formatTokenAmount, getTokenTicker } from '@/app/lib/token-utils';

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
    console.debug('[sdk-read-client] loadKeeta start');
    // Use native dynamic import so the bundler rewrites the specifier correctly
    const mod = await import('@keetanetwork/keetanet-client');
    const hasUserClient = Boolean((mod as any)?.UserClient);
    const hasLib = Boolean((mod as any)?.lib);
    console.debug('[sdk-read-client] loadKeeta done', { hasUserClient, hasLib });
    return mod;
  } catch (e) {
    console.error('[sdk-read-client] loadKeeta failed', e);
    throw e;
  }
}

const NetworkNameSchema = z.union([z.literal('test'), z.literal('main')]);

function getNetwork(): 'test' | 'main' {
  const env = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_KEETA_NETWORK) || 'test';
  const parsed = NetworkNameSchema.safeParse(env);
  return parsed.success ? parsed.data : 'test';
}

let cachedClient: any | null = null;

export async function getReadClient(): Promise<any> {
  if (cachedClient) return cachedClient;

  const KeetaNet = await loadKeeta();
  const seed = KeetaNet.lib.Account.generateRandomSeed({ asString: true });
  const account = KeetaNet.lib.Account.fromSeed(seed, 0);
  const network = getNetwork();

  let client: any;
  if (typeof (KeetaNet as any).UserClient?.fromNetwork === 'function') {
    console.debug('[sdk-read-client] getReadClient using fromNetwork', { network });
    client = (KeetaNet as any).UserClient.fromNetwork(network, account);
  } else if (typeof (KeetaNet as any).UserClient === 'function') {
    console.debug('[sdk-read-client] getReadClient using ctor', { network });
    client = new (KeetaNet as any).UserClient({ network, account });
  } else {
    throw new Error('Keeta SDK UserClient not available');
  }

  cachedClient = client;
  console.debug('[sdk-read-client] getReadClient ready');
  return client;
}

async function getClientForPublicAccount(publicKey: string): Promise<any> {
  const KeetaNet = await loadKeeta();
  const network = getNetwork();
  const account = KeetaNet.lib.Account.fromPublicKeyString(publicKey);

  if (typeof (KeetaNet as any).UserClient?.fromNetwork === 'function') {
    try {
      console.debug('[sdk-read-client] getClientForPublicAccount using fromNetwork', { network, publicKey });
      return (KeetaNet as any).UserClient.fromNetwork(network, null, { account });
    } catch (e) {
      console.warn('[sdk-read-client] getClientForPublicAccount fromNetwork failed, falling back', e);
      // fall-through
    }
  }

  if (typeof (KeetaNet as any).UserClient === 'function') {
    console.debug('[sdk-read-client] getClientForPublicAccount using ctor', { network, publicKey });
    return new (KeetaNet as any).UserClient({ network, account });
  }

  throw new Error('Keeta SDK UserClient not available');
}

export async function getAccountState(publicKey: string): Promise<unknown | null> {
  try {
    const KeetaNet = await loadKeeta();
    const client = await getReadClient();
    const account = KeetaNet.lib.Account.fromPublicKeyString(publicKey);

    if (typeof client.state === 'function') {
      console.debug('[sdk-read-client] getAccountState via client.state', { publicKey });
      const res = await client.state({ account });
      const hasBalances = Array.isArray((res as any)?.balances) && (res as any).balances.length > 0;
      console.debug('[sdk-read-client] getAccountState result', { hasBalances });
      return res;
    }
    if (typeof client.account === 'function') {
      console.debug('[sdk-read-client] getAccountState via client.account', { publicKey });
      const res = await client.account(publicKey);
      console.debug('[sdk-read-client] getAccountState result (account)');
      return res;
    }
    if (typeof client.getAccount === 'function') {
      console.debug('[sdk-read-client] getAccountState via client.getAccount', { publicKey });
      const res = await client.getAccount(publicKey);
      console.debug('[sdk-read-client] getAccountState result (getAccount)');
      return res;
    }
    return null;
  } catch (e) {
    console.error('[sdk-read-client] getAccountState error', e);
    return null;
  }
}

export async function getHistory(options?: { depth?: number; cursor?: string | null }): Promise<unknown> {
  try {
    const client = await getReadClient();
    const query: Record<string, unknown> = {};
    if (options?.depth != null) query.depth = Math.max(1, Math.min(options.depth, 100));
    if (options?.cursor) (query as any).startBlocksHash = options.cursor;

    if (typeof client.history === 'function') {
      console.debug('[sdk-read-client] getHistory', { query });
      const res = await client.history(query);
      console.debug('[sdk-read-client] getHistory result', { length: Array.isArray(res) ? res.length : undefined });
      return res;
    }
    return [];
  } catch (e) {
    console.error('[sdk-read-client] getHistory error', e);
    return [];
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

    console.debug('[sdk-read-client] listStorageAccountsByOwner result', { count: results.length });
    return results;
  } catch (e) {
    console.error('[sdk-read-client] listStorageAccountsByOwner error', e);
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
      console.warn('[sdk-read-client] listStorageAccountsByOwner not supported');
      return [];
    }

    console.log('[sdk-read-client] listStorageAccountsByOwner start', { owner: ownerPublicKey });
    let entries = await client.listACLsByPrincipal([owner]);
    let calledShape: 'array' | 'object' = 'array';
    if (!entries || (Array.isArray(entries) && entries.length === 0)) {
      try {
        // Some client versions expect an object shape: { account }
        entries = await client.listACLsByPrincipal({ account: owner });
        calledShape = 'object';
      } catch (e) {
        try { console.debug('[sdk-read-client] listACLsByPrincipal object-shape call failed', e); } catch {}
      }
    }
    try {
      console.log('[sdk-read-client] listACLsByPrincipal returned', {
        type: typeof entries,
        isArray: Array.isArray(entries),
        count: Array.isArray(entries) ? entries.length : undefined,
        sample: Array.isArray(entries) && entries.length > 0 ? Object.keys(entries[0] ?? {}).slice(0, 6) : null,
        calledShape,
      });
    } catch {}
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
            try { console.log('[sdk-read-client] ACL skipped (not storage)', { entityType: typeof entity, hasIsStorage: typeof entity?.isStorage === 'function', permissions }); } catch {}
            continue;
          }

          const principalS = toAccountString((acl as any).principal);
          const entityS = toAccountString((acl as any).entity);
          const targetS = toAccountString((acl as any).target);
          results.push({ principal: principalS, entity: entityS, target: targetS, permissions });
          try { console.log('[sdk-read-client] ACL accepted', { principal: principalS, entity: entityS, target: targetS, permissionsCount: permissions.length }); } catch {}
        } catch (e) {
          try { console.warn('[sdk-read-client] ACL parse error', e); } catch {}
          // skip malformed entry
        }
      }
    }

    try { console.log('[sdk-read-client] listStorageAccountsByOwner done', { count: results.length }); } catch {}
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

    // Shared metadata cache across owner and storage lookups
    const tokenMetaCache = new Map<string, { metadata?: string; decimals?: number; name?: string; ticker?: string }>();

    console.debug('[sdk-read-client] getAggregatedBalancesForOwner start', { ownerPublicKey, maxStorages, includeTokenMetadata });
    try {
      const ownerAccount = KeetaNet.lib.Account.fromPublicKeyString(ownerPublicKey);
      const ownerState = await client.state({ account: ownerAccount });
      const balances: any[] = Array.isArray(ownerState?.balances) ? ownerState.balances : [];
      for (const entry of balances) {
        const tokenAddr = normalizeAccountAddress((entry as any)?.token ?? (entry as any)?.publicKey) ?? '';
        if (!tokenAddr) continue;

        const amount = toBigInt((entry as any)?.balance ?? (entry as any)?.amount);
        let decimals = typeof (entry as any)?.decimals === 'number' ? (entry as any).decimals : undefined;
        let metadata = typeof (entry as any)?.metadata === 'string' ? (entry as any).metadata : undefined;

        // Enrich owner balances with token metadata & decimals if missing
        let name: string | undefined;
        let ticker: string | undefined;
        if (includeTokenMetadata && (!decimals || !metadata)) {
          if (tokenMetaCache.has(tokenAddr)) {
            const cached = tokenMetaCache.get(tokenAddr)!;
            decimals = decimals ?? cached.decimals;
            metadata = metadata ?? cached.metadata;
            name = cached.name ?? name;
            ticker = cached.ticker ?? ticker;
          } else {
            try {
              const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(tokenAddr);
              const tokenState = await client.state({ account: tokenAccount });
              const info = tokenState?.info ?? {};
              const md = typeof info?.metadata === 'string' ? info.metadata : undefined;
              let decValid: number | undefined;
              if (md) {
                try {
                  const decInfo = extractDecimalsAndFieldType(md);
                  decValid = decInfo.decimals;
                } catch {}
              }
              const nm = typeof (info as any)?.name === 'string' ? (info as any).name : undefined;
              const tkSym = typeof (info as any)?.symbol === 'string' ? (info as any).symbol : undefined;
              const tkTicker = typeof (info as any)?.ticker === 'string' ? (info as any).ticker : undefined;
              const tkCode = typeof (info as any)?.currencyCode === 'string' ? (info as any).currencyCode : undefined;
              const tkMeta = md ? getTokenTicker(md) : undefined;
              const tk = (tkSym || tkTicker || tkCode || tkMeta)?.toString().trim().toUpperCase();
              try {
                console.debug('[sdk-read-client] owner token info fields', {
                  token: tokenAddr,
                  name: nm,
                  symbol: tkSym,
                  ticker: tkTicker,
                  currencyCode: tkCode,
                  metaTicker: tkMeta,
                  derivedTicker: tk,
                });
              } catch {}
              tokenMetaCache.set(tokenAddr, { metadata: md, decimals: decValid, name: nm, ticker: tk });
              metadata = metadata ?? md;
              decimals = decimals ?? decValid;
              name = name ?? nm;
              ticker = ticker ?? tk;
              try { console.debug('[sdk-read-client] owner token metadata fetched', { token: tokenAddr, hasMetadata: Boolean(md), decimals: decValid }); } catch {}
            } catch {
              tokenMetaCache.set(tokenAddr, { metadata: undefined, decimals: undefined });
            }
          }
        }

        upsert(tokenAddr, amount, metadata, decimals, name, ticker);
      }
    } catch (e) {
      console.warn('[sdk-read-client] owner balances read failed', e);
    }

    let storages: Array<{ entity?: string }> = [];
    try {
      const acl = await listStorageAccountsByOwner(ownerPublicKey);
      storages = Array.isArray(acl) ? acl.slice(0, maxStorages) : [];
      console.debug('[sdk-read-client] storage accounts', { count: storages.length });
    } catch (e) {
      console.warn('[sdk-read-client] listStorageAccountsByOwner failed', e);
      storages = [];
    }

    // tokenMetaCache declared above; reused here as well

    const fetchStorage = async (address: string) => {
      try {
        const storageAccount = KeetaNet.lib.Account.fromPublicKeyString(address);
        const storageState = await client.state({ account: storageAccount });
        const balances: any[] = Array.isArray(storageState?.balances) ? storageState.balances : [];

        for (const entry of balances) {
          const tokenAddr = normalizeAccountAddress((entry as any)?.token ?? (entry as any)?.publicKey) ?? '';
          if (!tokenAddr) continue;

          const amount = toBigInt((entry as any)?.balance ?? (entry as any)?.amount);
          let decimals = typeof (entry as any)?.decimals === 'number' ? (entry as any).decimals : undefined;
          let metadata = typeof (entry as any)?.metadata === 'string' ? (entry as any).metadata : undefined;
          let name: string | undefined;
          let ticker: string | undefined;

          if (includeTokenMetadata && (!decimals || !metadata)) {
            if (tokenMetaCache.has(tokenAddr)) {
              const cached = tokenMetaCache.get(tokenAddr)!;
              decimals = decimals ?? cached.decimals;
              metadata = metadata ?? cached.metadata;
              name = cached.name ?? name;
              ticker = cached.ticker ?? ticker;
            } else {
              try {
                const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(tokenAddr);
                const tokenState = await client.state({ account: tokenAccount });
                const info = tokenState?.info ?? {};
                const md = typeof info?.metadata === 'string' ? info.metadata : undefined;
                let decValid: number | undefined;
                if (md) {
                  try {
                    const decInfo = extractDecimalsAndFieldType(md);
                    decValid = decInfo.decimals;
                  } catch {}
                }
                const nm = typeof (info as any)?.name === 'string' ? (info as any).name : undefined;
                const tkSym = typeof (info as any)?.symbol === 'string' ? (info as any).symbol : undefined;
                const tkTicker = typeof (info as any)?.ticker === 'string' ? (info as any).ticker : undefined;
                const tkCode = typeof (info as any)?.currencyCode === 'string' ? (info as any).currencyCode : undefined;
                const tkMeta = md ? getTokenTicker(md) : undefined;
                const tk = (tkSym || tkTicker || tkCode || tkMeta)?.toString().trim().toUpperCase();
                try {
                  console.debug('[sdk-read-client] storage token info fields', {
                    token: tokenAddr,
                    name: nm,
                    symbol: tkSym,
                    ticker: tkTicker,
                    currencyCode: tkCode,
                    metaTicker: tkMeta,
                    derivedTicker: tk,
                  });
                } catch {}
                tokenMetaCache.set(tokenAddr, { metadata: md, decimals: decValid, name: nm, ticker: tk });
                metadata = metadata ?? md;
                decimals = decimals ?? decValid;
                name = name ?? nm;
                ticker = ticker ?? tk;
              } catch {
                tokenMetaCache.set(tokenAddr, { metadata: undefined, decimals: undefined });
              }
            }
          }

          upsert(tokenAddr, amount, metadata, decimals, name, ticker);
        }
      } catch (e) {
        console.warn('[sdk-read-client] fetchStorage failed', { address }, e);
      }
    };

    await Promise.allSettled(storages.map((s) => (s.entity ? fetchStorage(s.entity) : Promise.resolve())));

    const result: Array<{ token: string; balance: string; metadata?: string; decimals?: number; name?: string; ticker?: string }> = [];
    for (const [token, info] of totals.entries()) {
      result.push({ token, balance: info.balance.toString(), metadata: info.metadata, decimals: info.decimals, name: info.name, ticker: info.ticker });
    }
    try {
      const summary = result.map(r => ({ token: r.token, name: r.name ?? null, ticker: r.ticker ?? null, decimals: r.decimals ?? null, hasMeta: Boolean(r.metadata) }));
      console.debug('[sdk-read-client] aggregated totals summary', summary);
    } catch {}
    console.debug('[sdk-read-client] getAggregatedBalancesForOwner done', { tokens: result.length, distinctTokens: result.map(r => r.token) });
    return result;
  } catch (e) {
    console.error('[sdk-read-client] getAggregatedBalancesForOwner error', e);
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
    const client = await getClientForPublicAccount(accountPublicKey);

    const depth = Math.max(1, Math.min(options?.depth ?? 25, 100));
    const query: Record<string, unknown> = { depth };
    if (options?.cursor) (query as any).startBlocksHash = options.cursor;

    console.debug('[sdk-read-client] getHistoryForAccount start', { accountPublicKey, query });
    const response: any[] = typeof client.history === 'function' ? await client.history(query) : [];
    if (!Array.isArray(response) || response.length === 0) return [];

    const staplesWithEffects = response.filter((entry) => Boolean(entry?.voteStaple && entry?.effects));
    if (!staplesWithEffects.length) return [];

    const voteStaples = staplesWithEffects.map((entry) => entry.voteStaple);
    const filtered: Record<string, Array<{ block: any; filteredOperations: any[] }>> = typeof client.filterStapleOperations === 'function'
      ? client.filterStapleOperations(voteStaples)
      : {};

    const normalizeAddress = (candidate: unknown): string | undefined => {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }
      try {
        const normalized = (candidate && (candidate as any).publicKeyString)
          ? String((candidate as any).publicKeyString)
          : undefined;
        if (normalized && normalized.trim().length > 0) return normalized;
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
    const tokenMetaCache = new Map<string, { name?: string; ticker?: string; decimals?: number } | null>();

    for (const [stapleHash, blocks] of Object.entries(filtered)) {
      for (const { block, filteredOperations } of blocks) {
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

          if (accountPublicKey !== from && accountPublicKey !== to && accountPublicKey !== blockAccount) {
            continue;
          }

          let tokenMetadata: { name?: string; ticker?: string; decimals?: number } | null = null;
          if (includeTokenMetadata && token) {
            if (tokenMetaCache.has(token)) {
              tokenMetadata = tokenMetaCache.get(token) ?? null;
            } else {
              try {
                const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(token);
                const tokenState = await client.state({ account: tokenAccount });
                const info = tokenState?.info ?? {};
                const metadata = info?.metadata;
                if (typeof metadata === 'string' && metadata.trim().length > 0) {
                  const TokenMetadataSchema = z.object({
                    name: z.string().optional(),
                    ticker: z.string().optional(),
                    symbol: z.string().optional(),
                    decimals: z.number().optional(),
                  });
                  try {
                    const parsedJson = JSON.parse(metadata);
                    const parsed = TokenMetadataSchema.safeParse(parsedJson);
                    if (parsed.success) {
                      tokenMetadata = {
                        name: parsed.data.name,
                        ticker: parsed.data.ticker ?? parsed.data.symbol,
                        decimals: parsed.data.decimals,
                      };
                    } else {
                      tokenMetadata = null;
                    }
                  } catch {
                    tokenMetadata = null;
                  }
                }
              } catch {
                tokenMetadata = null;
              }
              tokenMetaCache.set(token, tokenMetadata);
            }
          }

          results.push({
            id: blockHash || `${stapleHash}:${type}:${from ?? ''}:${to ?? ''}`,
            block: blockHash,
            timestamp: blockTimestamp,
            type,
            amount: amount ?? '0',
            from: from ?? '',
            to: to ?? '',
            token: token ?? '',
            tokenTicker: tokenMetadata?.ticker ?? null,
            tokenDecimals: typeof tokenMetadata?.decimals === 'number' ? tokenMetadata.decimals : null,
            tokenMetadata: tokenMetadata
              ? {
                  name: tokenMetadata.name ?? null,
                  ticker: tokenMetadata.ticker ?? null,
                  decimals: tokenMetadata.decimals ?? null,
                }
              : null,
          });
        }
      }
    }

    results.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    console.debug('[sdk-read-client] getHistoryForAccount done', { count: results.length });
    return results;
  } catch (e) {
    console.error('[sdk-read-client] getHistoryForAccount error', e);
    return [];
  }
}
