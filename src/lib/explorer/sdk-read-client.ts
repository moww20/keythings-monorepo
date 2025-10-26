"use client";
import { z } from 'zod';
import { extractDecimalsAndFieldType, formatAmountWithCommas, formatTokenAmount } from '@/app/lib/token-utils';

async function loadKeeta(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('Keeta SDK is only available in the browser');
  }
  const p1 = '@keetanetwork/keeta';
  const p2 = 'net-client';
  const spec = (p1 + 'net-client').replace('keetanet-client', '') + p2; // results in '@keetanetwork/keetanet-client'
  const dynamicImport = Function('s', 'return import(s)');
  return await (dynamicImport as any)(spec);
}

// Simple network selector (default to 'test')
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
  // Create ephemeral account for read-only operations
  const seed = KeetaNet.lib.Account.generateRandomSeed({ asString: true });
  const account = KeetaNet.lib.Account.fromSeed(seed, 0);
  const network = getNetwork();

  // Prefer documented constructor when available
  let client: any;
  if (typeof (KeetaNet as any).UserClient?.fromNetwork === 'function') {
    client = (KeetaNet as any).UserClient.fromNetwork(network, account);
  } else if (typeof (KeetaNet as any).UserClient === 'function') {
    client = new (KeetaNet as any).UserClient({ network, account });
  } else {
    throw new Error('Keeta SDK UserClient not available');
  }

  cachedClient = client;
  return client;
}

export async function getAccountState(publicKey: string): Promise<unknown | null> {
  try {
    const KeetaNet = await loadKeeta();
    const client = await getReadClient();
    const acct = KeetaNet.lib.Account.fromPublicKeyString(publicKey);
    // SDK state API
    if (typeof client.state === 'function') {
      return await client.state({ account: acct });
    }
    // Some SDKs expose account/getAccount
    if (typeof client.account === 'function') {
      return await client.account(publicKey);
    }
    if (typeof client.getAccount === 'function') {
      return await client.getAccount(publicKey);
    }
    return null;
  } catch {
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
      return await client.history(query);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Compute normalized balances for a given account using SDK state lookups.
 * Returns entries with token, balance, and display fields similar to wallet formatting.
 */
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
    const arr: any[] = Array.isArray((state as any)?.balances)
      ? (state as any).balances
      : Array.isArray((state as any)?.tokens)
      ? (state as any).tokens
      : [];

    if (!Array.isArray(arr) || arr.length === 0) return [];

    const client = await getReadClient();

    const toStringSafe = (v: any) => (typeof v === 'string' ? v : (v?.toString?.() ?? ''));

    const results: Array<{
      token: string;
      balance: string;
      name?: string;
      ticker?: string;
      decimals?: number;
      fieldType?: 'decimalPlaces' | 'decimals';
      formattedAmount?: string;
    }> = [];

    for (const entry of arr) {
      const tokenAddr = toStringSafe(entry?.token ?? entry?.publicKey);
      const rawBalance = toStringSafe(entry?.balance ?? '0');
      let name: string | undefined;
      let ticker: string | undefined;
      let decimals: number | undefined;
      let fieldType: 'decimalPlaces' | 'decimals' | undefined;
      let formattedAmount: string | undefined;

      // Fetch token state to derive metadata & decimals
      try {
        const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(tokenAddr);
        const tokenState = typeof (client as any).state === 'function' ? await (client as any).state({ account: tokenAccount }) : null;
        const info = tokenState?.info ?? {};
        const meta = (typeof info?.metadata === 'string') ? info.metadata : undefined;
        const d = extractDecimalsAndFieldType(meta);
        decimals = d.decimals ?? 0;
        fieldType = d.fieldType;
        name = typeof info?.name === 'string' ? info.name : undefined;
        ticker = typeof (info?.ticker ?? info?.symbol) === 'string' ? (info?.ticker ?? info?.symbol) : undefined;
        try {
          const fmt = formatTokenAmount(rawBalance, decimals, fieldType);
          formattedAmount = formatAmountWithCommas(fmt);
        } catch {
          formattedAmount = undefined;
        }
      } catch {
        // leave undefined, still return bare balance
      }

      results.push({ token: tokenAddr, balance: String(rawBalance), name, ticker, decimals, fieldType, formattedAmount });
    }

    return results;
  } catch {
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
    const entries = await client.listACLsByPrincipal([owner]);
    const results: Array<{ principal?: string; entity?: string; target?: string; permissions?: string[] }> = [];
    if (Array.isArray(entries)) {
      for (const acl of entries) {
        try {
          const entity: any = (acl as any).entity;
          const isStorage = typeof entity?.isStorage === 'function' ? !!entity.isStorage() : false;
          if (!isStorage) continue;
          const toStr = (v: any) => {
            if (typeof v === 'string') return v;
            try {
              if (v?.publicKeyString && typeof v.publicKeyString === 'string') return v.publicKeyString;
              if (v?.publicKeyString?.toString) return String(v.publicKeyString.toString());
              if (v?.toString) {
                const s = String(v.toString());
                if (s && s !== '[object Object]') return s;
              }
            } catch {}
            return undefined;
          };
          const permissionsArr: string[] = Array.isArray((acl as any).permissions)
            ? (acl as any).permissions.map((p: unknown) => (typeof p === 'string' ? p : String(p)))
            : [];
          results.push({
            principal: toStr((acl as any).principal),
            entity: toStr((acl as any).entity),
            target: toStr((acl as any).target),
            permissions: permissionsArr,
          });
        } catch {}
      }
    }
    return results;
  } catch {
    return [];
  }
}
