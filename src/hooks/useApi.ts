import { useEffect, useState } from 'react';
import { z } from 'zod';
import { accountApi, storageApi, tokenApi, transactionApi, networkApi } from '@/lib/api/client';
import { getAccountState } from '@/lib/explorer/sdk-read-client';
import {
  processTokenForDisplay,
  type TokenMetadataFetcher,
  type TokenMetadataLookupResult,
} from '@/app/lib/token-utils';
import type { TokenDisplayEntry } from '@/lib/explorer/mappers';
import {
  getCachedTokenMetadata,
  getTokenMetadata,
  type TokenMetadataEntry,
} from '@/lib/tokens/metadata-service';

const hasExplorerApiBase = typeof process.env.NEXT_PUBLIC_API_URL === 'string'
  && process.env.NEXT_PUBLIC_API_URL.trim().length > 0;

const TokenMetadataSchema = z.object({
  name: z.string().optional(),
  ticker: z.string().optional(),
  symbol: z.string().optional(),
  displayName: z.string().optional(),
  decimals: z.number().optional(),
  decimalPlaces: z.number().optional(),
}).passthrough();

type StorageTokenEntry = {
  tokenId: string;
  name?: string | null;
  symbol?: string | null;
  balance: string;
  decimals?: number;
};

const StorageBalanceEntrySchema = z.object({
  token: z.string().optional(),
  publicKey: z.string().optional(),
  balance: z.union([z.string(), z.number(), z.bigint()]).optional(),
  amount: z.union([z.string(), z.number(), z.bigint()]).optional(),
  decimals: z.number().optional(),
  metadata: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
}).passthrough();

const StorageInfoSchema = z.object({
  owner: z.string().optional(),
  type: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  createdAt: z.union([z.string(), z.number(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.number(), z.date()]).optional(),
}).partial();

const DateLikeSchema = z.union([z.string(), z.number(), z.date(), z.null()]).optional();

const StorageAccountStateSchema = z.object({
  publicKey: z.string().optional(),
  owner: z.string().optional(),
  type: z.string().optional(),
  createdAt: DateLikeSchema,
  updatedAt: DateLikeSchema,
  info: StorageInfoSchema.optional(),
  balances: z.array(StorageBalanceEntrySchema).optional(),
  tokens: z.array(StorageBalanceEntrySchema).optional(),
}).passthrough();

const toDateString = (value: unknown): string | null => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return null;
};

const pickString = (...values: (string | null | undefined)[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return undefined;
};

const pickNullableString = (
  ...values: (string | null | undefined)[]
): string | null => pickString(...values) ?? null;

const pickNumber = (
  ...values: (number | null | undefined)[]
): number | undefined => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
};

const toBalanceString = (value: unknown): string => {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return Math.trunc(value).toString();
  if (typeof value === 'string') return value;
  if (value && typeof (value as { toString?: () => string }).toString === 'function') {
    try {
      const toStringValue = String((value as { toString: () => string }).toString());
      return toStringValue === '[object Object]' ? '0' : toStringValue;
    } catch {
      return '0';
    }
  }
  return '0';
};

const normalizeMetadataInput = (rawMetadata: unknown): string | undefined => {
  if (!rawMetadata) {
    return undefined;
  }
  if (typeof rawMetadata === 'string') {
    return rawMetadata;
  }
  if (rawMetadata && typeof rawMetadata === 'object') {
    try {
      return JSON.stringify(rawMetadata);
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const decodeBase64String = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 4) {
    return null;
  }
  try {
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      return window.atob(trimmed);
    }
  } catch {
    // ignore browser decode failure and fall back to Buffer
  }
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(trimmed, 'base64').toString('utf-8');
    }
  } catch {
    // ignore server decode failure
  }
  return null;
};

const parseTokenMetadata = (rawMetadata: unknown) => {
  const normalized = normalizeMetadataInput(rawMetadata);
  if (!normalized) {
    return null;
  }

  const tryParse = (input: string) => {
    try {
      const parsedJson = JSON.parse(input);
      const parsed = TokenMetadataSchema.safeParse(parsedJson);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  };

  const directParse = tryParse(normalized);
  if (directParse) {
    return directParse;
  }

  const decoded = decodeBase64String(normalized);
  if (!decoded) {
    return null;
  }

  return tryParse(decoded);
};

const ARRAY_CANDIDATE_KEYS = [
  "balances",
  "tokens",
  "entries",
  "items",
  "records",
  "data",
  "list",
  "values",
];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const PUBLIC_KEY_FALLBACK_FIELDS = [
  "publicKey",
  "publicKeyString",
  "address",
  "account",
  "entity",
  "storage",
  "token",
];

const toPublicKeyString = (value: unknown, depth = 0): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "object") {
    if (depth > 4) {
      return undefined;
    }
    for (const key of PUBLIC_KEY_FALLBACK_FIELDS) {
      const candidate = (value as Record<string, unknown>)[key];
      const resolved = toPublicKeyString(candidate, depth + 1);
      if (resolved) {
        return resolved;
      }
    }
    if (typeof (value as { toString?: () => string }).toString === "function") {
      try {
        const stringified = String((value as { toString: () => string }).toString());
        return stringified && stringified !== "[object Object]"
          ? stringified
          : undefined;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
};

const normalizeTokenField = (entry: Record<string, unknown>, fallbackKey?: string): void => {
  const tokenField = entry.token;
  if (typeof tokenField === "string" && tokenField.trim().length > 0) {
    entry.token = tokenField.trim();
    return;
  }

  const tokenCandidate = toPublicKeyString(tokenField)
    ?? toPublicKeyString(entry.publicKey)
    ?? toPublicKeyString(entry.publicKeyString)
    ?? toPublicKeyString(entry.tokenAccount)
    ?? (typeof fallbackKey === "string" && fallbackKey.trim().length > 0 ? fallbackKey.trim() : undefined);

  if (tokenCandidate) {
    entry.token = tokenCandidate;
    return;
  }

  if (typeof entry.entity === "string" && entry.entity.trim().length > 0) {
    entry.token = entry.entity.trim();
  }
};

const normalizeBalanceEntries = (value: unknown): Array<Record<string, unknown>> => {
  if (!value) {
    return [];
  }

  const coerceTupleEntry = (entry: unknown[]): Record<string, unknown> | null => {
    if (!Array.isArray(entry)) {
      return null;
    }
    const [maybeToken, maybeBalance, extras] = entry;
    const payload: Record<string, unknown> = {};
    const tokenId = typeof maybeToken === "string"
      ? maybeToken
      : toPublicKeyString(maybeToken);
    if (tokenId) {
      payload.token = tokenId;
    }
    if (maybeBalance !== undefined) {
      payload.balance = maybeBalance;
    }
    if (isPlainObject(extras)) {
      Object.assign(payload, extras);
    }
    normalizeTokenField(payload);
    return payload.token ? payload : null;
  };

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (isPlainObject(entry)) {
          const copy = { ...entry } as Record<string, unknown>;
          normalizeTokenField(copy);
          return copy.token ? copy : null;
        }
        if (Array.isArray(entry)) {
          return coerceTupleEntry(entry);
        }
        if (typeof entry === "string") {
          return { token: entry };
        }
        if (entry === null || entry === undefined) {
          return null;
        }
        return { balance: entry } as Record<string, unknown>;
      })
      .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  }

  if (value instanceof Map) {
    return Array.from(value.entries())
      .map(([tokenKey, payload]) => {
        const fallbackKey = typeof tokenKey === "string"
          ? tokenKey
          : toPublicKeyString(tokenKey);
        if (isPlainObject(payload)) {
          const copy = { ...payload } as Record<string, unknown>;
          normalizeTokenField(copy, fallbackKey);
          return copy.token ? copy : null;
        }
        if (Array.isArray(payload)) {
          return coerceTupleEntry(payload);
        }
        if (fallbackKey) {
          const copy: Record<string, unknown> = { token: fallbackKey, balance: payload };
          normalizeTokenField(copy);
          return copy;
        }
        return null;
      })
      .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  }

  if (isPlainObject(value)) {
    for (const key of ARRAY_CANDIDATE_KEYS) {
      const nested = (value as Record<string, unknown>)[key];
      if (Array.isArray(nested)) {
        return normalizeBalanceEntries(nested);
      }
    }

    if (typeof (value as { toArray?: () => unknown }).toArray === "function") {
      try {
        const result = (value as { toArray: () => unknown }).toArray();
        return normalizeBalanceEntries(result);
      } catch {
        // ignore and fall through to object iteration
      }
    }

    return Object.entries(value as Record<string, unknown>)
      .map(([tokenKey, payload]) => {
        if (payload === null || payload === undefined) {
          return null;
        }

        if (isPlainObject(payload)) {
          const copy = { ...payload } as Record<string, unknown>;
          normalizeTokenField(copy, tokenKey);
          return copy.token ? copy : null;
        }

        if (Array.isArray(payload)) {
          return coerceTupleEntry(payload);
        }

        const fallbackKey = typeof tokenKey === "string" && tokenKey.trim().length > 0
          ? tokenKey.trim()
          : undefined;
        const tokenId = fallbackKey ?? toPublicKeyString(payload);
        if (tokenId) {
          const copy: Record<string, unknown> = { token: tokenId, balance: payload };
          normalizeTokenField(copy);
          return copy;
        }

        return null;
      })
      .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  }

  return [];
};

const normalizeStorageCandidate = (candidate: Record<string, unknown>) => {
  const normalized: Record<string, unknown> = { ...candidate };

  const infoRecord = isPlainObject(normalized.info) ? { ...normalized.info } : undefined;
  if (infoRecord) {
    normalized.info = infoRecord;
  } else if (normalized.info !== undefined) {
    delete normalized.info;
  }

  (['balances', 'tokens'] as const).forEach((key) => {
    if (key in normalized) {
      const entries = normalizeBalanceEntries((normalized as Record<string, unknown>)[key]);
      if (entries.length > 0) {
        normalized[key] = entries;
      } else {
        delete normalized[key];
      }
    }
  });

  if (!normalized.publicKey) {
    const fallbackKeys = [
      normalized.publicKeyString,
      normalized.address,
      normalized.storage,
    ].filter((value): value is string => typeof value === "string");
    if (fallbackKeys.length > 0) {
      normalized.publicKey = fallbackKeys[0];
    } else if (isPlainObject(normalized.account)) {
      const accountRecord = normalized.account as Record<string, unknown>;
      const nestedKey = [
        accountRecord.publicKey,
        accountRecord.publicKeyString,
        accountRecord.address,
      ].find((value) => typeof value === "string");
      if (nestedKey) {
        normalized.publicKey = nestedKey;
      }
    }
  }

  const sourceForType = [normalized.type, infoRecord?.type]
    .find((value): value is string => typeof value === "string" && value.length > 0);
  if (sourceForType) {
    normalized.type = sourceForType;
  }

  const sourceForOwner = [normalized.owner, infoRecord?.owner]
    .find((value): value is string => typeof value === "string" && value.length > 0);
  if (sourceForOwner) {
    normalized.owner = sourceForOwner;
  }

  if (!normalized.createdAt && infoRecord?.createdAt !== undefined) {
    normalized.createdAt = infoRecord.createdAt;
  }

  if (!normalized.updatedAt && infoRecord?.updatedAt !== undefined) {
    normalized.updatedAt = infoRecord.updatedAt;
  }

  return normalized;
};

const collectCandidateRecords = (root: unknown): Record<string, unknown>[] => {
  if (!root || typeof root !== "object") {
    return [];
  }

  const candidates: Record<string, unknown>[] = [];
  const seen = new Set<unknown>();
  const stack: unknown[] = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || seen.has(current)) {
      continue;
    }
    seen.add(current);

    if (isPlainObject(current)) {
      candidates.push(current);
      const nestedCandidates = [
        current.account,
        current.state,
        current.data,
      ];
      nestedCandidates.forEach((nested) => {
        if (nested && typeof nested === "object" && !seen.has(nested)) {
          stack.push(nested);
        }
      });
    }
  }

  return candidates;
};

const parseStorageState = (rawState: unknown) => {
  if (!rawState || typeof rawState !== 'object') {
    return null;
  }

  const candidates = collectCandidateRecords(rawState);

  for (const candidate of candidates) {
    const normalized = normalizeStorageCandidate(candidate);
    const parsed = StorageAccountStateSchema.safeParse(normalized);
    if (parsed.success) {
      return parsed.data;
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    try {
      console.warn('[useStorage] Unable to normalize storage state payload', {
        keys: Object.keys(rawState as Record<string, unknown>),
      });
    } catch {
      // no-op
    }
  }

  return null;
};

const fetchStorageFromChain = async (publicKey: string) => {
  let rawState: unknown = await getAccountState(publicKey);

  if (!rawState && typeof window !== 'undefined') {
    const provider = (window as { keeta?: Record<string, unknown> }).keeta;
    if (provider) {
      try {
        await (provider.requestCapabilities as ((caps: string[]) => Promise<unknown>) | undefined)?.(['read']);
      } catch {}

      try {
        if (typeof provider.getAccountInfo === 'function') {
          rawState = await provider.getAccountInfo(publicKey);
        } else if (typeof provider.request === 'function') {
          rawState = await provider.request({ method: 'keeta_getAccountInfo', params: [publicKey] });
        }
      } catch (walletError) {
        console.warn('Wallet provider getAccountInfo failed', walletError);
      }
    }
  }

  const state = parseStorageState(rawState);
  if (!state) {
    return null;
  }

  const info = state.info ?? {};
  const owner = info.owner ?? state.owner ?? null;
  const type = info.type ?? state.type ?? 'STORAGE';
  const createdAt = toDateString(info.createdAt ?? state.createdAt ?? null);
  const updatedAt = toDateString(info.updatedAt ?? state.updatedAt ?? null);

  const balancesSource = Array.isArray(state.balances) && state.balances.length > 0
    ? state.balances
    : Array.isArray(state.tokens) ? state.tokens : [];

  const mappedTokens = await Promise.all<StorageTokenEntry | null>(
    balancesSource.map(async (entry): Promise<StorageTokenEntry | null> => {
      const tokenIdCandidate = toPublicKeyString(entry.token)
        ?? (typeof entry.token === 'string' ? entry.token : undefined)
        ?? (typeof entry.publicKey === 'string' ? entry.publicKey : undefined)
        ?? (typeof entry.publicKeyString === 'string' ? entry.publicKeyString : undefined)
        ?? (typeof entry.address === 'string' ? entry.address : undefined);
      const tokenId = tokenIdCandidate?.trim();
      if (!tokenId) return null;

      const inlineMetadata = parseTokenMetadata(entry.metadata);

      let serviceMetadataEntry = getCachedTokenMetadata(tokenId);
      if (!serviceMetadataEntry) {
        try {
          serviceMetadataEntry = await getTokenMetadata(tokenId);
        } catch (metadataError) {
          if (process.env.NODE_ENV !== 'production') {
            try {
              console.warn('[useStorage] Failed to load token metadata', {
                tokenId,
                metadataError,
              });
            } catch {}
          }
        }
      }

      const serviceMetadata = serviceMetadataEntry?.metadataBase64
        ? parseTokenMetadata(serviceMetadataEntry.metadataBase64)
        : null;

      const decimals = pickNumber(
        serviceMetadataEntry?.decimals,
        serviceMetadata?.decimals,
        serviceMetadata?.decimalPlaces,
        inlineMetadata?.decimals,
        inlineMetadata?.decimalPlaces,
        entry.decimals,
      );

      const name = pickNullableString(
        serviceMetadataEntry?.name,
        serviceMetadata?.name,
        serviceMetadata?.displayName,
        serviceMetadataEntry?.ticker,
        serviceMetadata?.ticker,
        serviceMetadata?.symbol,
        inlineMetadata?.name,
        inlineMetadata?.symbol,
        inlineMetadata?.ticker,
      );

      const symbol = pickNullableString(
        serviceMetadataEntry?.ticker,
        serviceMetadata?.ticker,
        serviceMetadata?.symbol,
        inlineMetadata?.ticker,
        inlineMetadata?.symbol,
      );

      return {
        tokenId,
        name,
        symbol,
        balance: toBalanceString(entry.balance ?? entry.amount ?? '0'),
        decimals,
      } satisfies StorageTokenEntry;
    }),
  );

  const tokens = mappedTokens.filter(
    (tokenEntry): tokenEntry is StorageTokenEntry => tokenEntry !== null,
  );

  return {
    publicKey: state.publicKey ?? publicKey,
    owner,
    type,
    createdAt,
    updatedAt,
    tokens,
    certificates: [] as unknown[],
  };
};

// Hook for fetching account data
export function useAccount(publicKey: string | undefined) {
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!publicKey) return;

    const fetchAccount = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await accountApi.getAccount(publicKey);
        setAccount(data);
      } catch (err) {
        console.error('Failed to fetch account:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch account'));
      } finally {
        setLoading(false);
      }
    };

    fetchAccount();
  }, [publicKey]);

  return { data: account, loading, error };
}

// Hook for fetching storage data
export function useStorage(publicKey: string | undefined) {
  const [storage, setStorage] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!publicKey) return;

    const fetchStorage = async () => {
      try {
        setLoading(true);
        setError(null);
        let data: unknown = null;

        if (hasExplorerApiBase) {
          try {
            data = await storageApi.getStorage(publicKey);
          } catch (apiError) {
            console.warn('Storage API request failed, falling back to on-chain state', apiError);
          }
        }

        if (!data) {
          data = await fetchStorageFromChain(publicKey);
        }

        if (!data) {
          throw new Error('Storage account data is unavailable.');
        }

        setStorage(data);
      } catch (err) {
        console.error('Failed to fetch storage:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch storage'));
        setStorage(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStorage();
  }, [publicKey]);

  return { data: storage, loading, error };
}

// Hook for fetching token data
export function useToken(tokenId: string | undefined) {
  const [token, setToken] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!tokenId) return;

    const fetchToken = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await tokenApi.getToken(tokenId);
        setToken(data);
      } catch (err) {
        console.error('Failed to fetch token:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch token'));
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, [tokenId]);

  return { data: token, loading, error };
}

// Hook for fetching transaction data
export function useTransaction(txHash: string | undefined) {
  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!txHash) return;

    const fetchTransaction = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await transactionApi.getTransaction(txHash);
        setTransaction(data);
      } catch (err) {
        console.error('Failed to fetch transaction:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch transaction'));
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();
  }, [txHash]);

  return { data: transaction, loading, error };
}

// Hook for fetching network status
export function useNetworkStatus() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await networkApi.getNetworkStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch network status:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch network status'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return { data: status, loading, error, refresh: fetchStatus };
}
