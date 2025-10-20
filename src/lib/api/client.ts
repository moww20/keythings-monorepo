const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const REQUEST_TIMEOUT_MS = 10000;

interface RequestOptions extends RequestInit {
  query?: Record<string, string | number | undefined>;
  parseJson?: boolean;
}

async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { query, parseJson = true, headers, ...init } = options;

  const url = new URL(path, API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = response.statusText || 'An error occurred';
      try {
        const errorBody = await response.json();
        if (typeof errorBody?.message === 'string') {
          message = errorBody.message;
        }
      } catch (parseError) {
        // Ignore JSON parse errors and fall back to status text
      }

      throw new Error(message);
    }

    if (!parseJson || response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error instanceof Error ? error : new Error('An error occurred');
  } finally {
    clearTimeout(timeout);
  }
}

// Account endpoints
export const accountApi = {
  getAccount: (publicKey: string) => request(`/accounts/${publicKey}`),
  getAccountCertificates: (publicKey: string) => request(`/accounts/${publicKey}/certificates`),
  getAccountTransactions: (publicKey: string, limit = 10, offset = 0) =>
    request(`/accounts/${publicKey}/transactions`, {
      query: { limit, offset },
    }),
};

// Storage endpoints
export const storageApi = {
  getStorage: (publicKey: string) => request(`/storage/${publicKey}`),
  getStorageHistory: (publicKey: string, limit = 10, offset = 0) =>
    request(`/storage/${publicKey}/history`, {
      query: { limit, offset },
    }),
};

// Token endpoints
export const tokenApi = {
  getToken: (tokenId: string) => request(`/tokens/${tokenId}`),
  getTokenHolders: (tokenId: string, limit = 10, offset = 0) =>
    request(`/tokens/${tokenId}/holders`, {
      query: { limit, offset },
    }),
  getTokenTransactions: (tokenId: string, limit = 10, offset = 0) =>
    request(`/tokens/${tokenId}/transactions`, {
      query: { limit, offset },
    }),
};

// Transaction endpoints
export const transactionApi = {
  getTransaction: (txHash: string) => request(`/transactions/${txHash}`),
  submitTransaction: (signedTx: any) => request('/transactions', {
    method: 'POST',
    body: JSON.stringify({ tx: signedTx }),
  }),
};

// Network endpoints
export const networkApi = {
  getNetworkStatus: () => request('/network/status'),
  getLatestBlocks: (limit = 10) => request('/network/blocks', {
    query: { limit },
  }),
  getLatestTransactions: (limit = 10) => request('/network/transactions', {
    query: { limit },
  }),
};
