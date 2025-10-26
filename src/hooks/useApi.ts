import { useEffect, useState } from 'react';
import { z } from 'zod';
import { accountApi, storageApi, tokenApi, transactionApi, networkApi } from '@/lib/api/client';
import { getAccountState } from '@/lib/explorer/sdk-read-client';

const hasExplorerApiBase = typeof process.env.NEXT_PUBLIC_API_URL === 'string'
  && process.env.NEXT_PUBLIC_API_URL.trim().length > 0;

const TokenMetadataSchema = z.object({
  name: z.string().optional(),
  ticker: z.string().optional(),
  symbol: z.string().optional(),
  decimals: z.number().optional(),
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
  metadata: z.string().optional(),
}).passthrough();

const StorageAccountStateSchema = z.object({
  publicKey: z.string().optional(),
  owner: z.string().optional(),
  type: z.string().optional(),
  createdAt: z.union([z.string(), z.number(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.number(), z.date()]).optional(),
  info: z.object({
    owner: z.string().optional(),
    type: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    createdAt: z.union([z.string(), z.number(), z.date()]).optional(),
    updatedAt: z.union([z.string(), z.number(), z.date()]).optional(),
  }).partial().optional(),
  balances: z.array(StorageBalanceEntrySchema).optional(),
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

const parseTokenMetadata = (rawMetadata: string | undefined) => {
  if (!rawMetadata) {
    return null;
  }
  try {
    const parsedJson = JSON.parse(rawMetadata);
    const parsed = TokenMetadataSchema.safeParse(parsedJson);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

const fetchStorageFromChain = async (publicKey: string) => {
  const rawState = await getAccountState(publicKey);
  if (!rawState) {
    return null;
  }

  const parsed = StorageAccountStateSchema.safeParse(rawState);
  if (!parsed.success) {
    return null;
  }

  const state = parsed.data;
  const info = state.info ?? {};
  const owner = info.owner ?? state.owner ?? null;
  const type = info.type ?? state.type ?? 'STORAGE';
  const createdAt = toDateString(info.createdAt ?? state.createdAt ?? null);
  const updatedAt = toDateString(info.updatedAt ?? state.updatedAt ?? null);

  const tokens = (state.balances ?? [])
    .map<StorageTokenEntry | null>((entry) => {
      const tokenId = entry.token ?? entry.publicKey;
      if (!tokenId) return null;

      const metadata = parseTokenMetadata(entry.metadata);
      const decimals = entry.decimals ?? metadata?.decimals;
      const name = metadata?.name ?? metadata?.symbol ?? metadata?.ticker;
      const symbol = metadata?.ticker ?? metadata?.symbol;

      return {
        tokenId,
        name,
        symbol,
        balance: toBalanceString(entry.balance ?? entry.amount ?? '0'),
        decimals,
      };
    })
    .filter((tokenEntry): tokenEntry is StorageTokenEntry => tokenEntry !== null);

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
