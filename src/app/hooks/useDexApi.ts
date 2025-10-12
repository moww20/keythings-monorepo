'use client';

import { useCallback, useState } from 'react';

import { useWallet } from '@/app/contexts/WalletContext';
import type {
  ApiBalanceEntry,
  ApiDepositAddressResponse,
  ApiLimitOrderPayload,
  ApiWithdrawRequest,
  OrderRequestPayload,
} from '@/app/types/trading';

const API_ORIGIN = (process.env.NEXT_PUBLIC_DEX_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const API_BASE_URL = `${API_ORIGIN}/api`;

function joinApiEndpoint(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error('Failed to parse API response');
  }
}

export function useDexApi() {
  const { publicKey, signMessage } = useWallet();
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const ensureUserId = useCallback(() => {
    if (!publicKey) {
      throw new Error('Connect your wallet to continue.');
    }
    return publicKey;
  }, [publicKey]);

  const login = useCallback(async () => {
    const userId = ensureUserId();
    if (!signMessage) {
      throw new Error('Connect and unlock your wallet to continue.');
    }

    if (isAuthenticating && token) {
      return token;
    }

    setIsAuthenticating(true);
    try {
      const challengeResponse = await fetch(
        joinApiEndpoint(`/auth/challenge/${encodeURIComponent(userId)}`),
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      );

      if (!challengeResponse.ok) {
        throw new Error('Failed to request authentication challenge');
      }

      const { nonce } = await parseJson<{ nonce: string }>(challengeResponse);
      if (!nonce) {
        throw new Error('Authentication challenge is invalid');
      }

      const message = `keeta-login:${nonce}`;
      const signature = await signMessage(message);

      const verifyResponse = await fetch(joinApiEndpoint('/auth/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          signature,
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Authentication failed');
      }

      const { jwt } = await parseJson<{ jwt: string }>(verifyResponse);
      if (!jwt) {
        throw new Error('Authentication token missing');
      }

      setToken(jwt);
      return jwt;
    } finally {
      setIsAuthenticating(false);
    }
  }, [ensureUserId, isAuthenticating, signMessage, token]);

  const apiRequest = useCallback(
    async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
      let authToken = token;

      if (!authToken) {
        authToken = await login();
      }

      const response = await fetch(joinApiEndpoint(endpoint), {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          ...(options.headers ?? {}),
        },
      });

      if (response.status === 401) {
        setToken(null);
        throw new Error('Session expired, please re-authenticate');
      }

      if (!response.ok) {
        throw new Error(response.statusText || 'API request failed');
      }

      return parseJson<T>(response);
    },
    [login, token],
  );

  const placeOrder = useCallback(
    (order: OrderRequestPayload) => {
      const userId = ensureUserId();
      const payload: ApiLimitOrderPayload = {
        user_id: userId,
        market: order.market,
        side: order.side,
        price: order.type === 'market' ? '0' : order.price,
        quantity: order.quantity,
        tif: order.type === 'limit' ? order.timeInForce ?? 'gtc' : undefined,
      };
      return apiRequest('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    [apiRequest, ensureUserId],
  );

  const cancelOrder = useCallback(
    (orderId: string) => {
      const userId = ensureUserId();
      const query = new URLSearchParams({ user_id: userId }).toString();
      return apiRequest(`/orders/${encodeURIComponent(orderId)}?${query}`, {
        method: 'DELETE',
        body: JSON.stringify({ id: orderId }),
      });
    },
    [apiRequest, ensureUserId],
  );

  const getBalances = useCallback(() => {
    const userId = ensureUserId();
    return apiRequest<ApiBalanceEntry[]>(`/balances/${encodeURIComponent(userId)}`);
  }, [apiRequest, ensureUserId]);

  const getDepositAddress = useCallback(
    (tokenMint: string) => {
      const userId = ensureUserId();
      return apiRequest<ApiDepositAddressResponse>(
        `/deposit/${encodeURIComponent(userId)}/${encodeURIComponent(tokenMint)}`,
      );
    },
    [apiRequest, ensureUserId],
  );

  const requestWithdrawal = useCallback(
    (payload: { token: string; amount: string; to: string }) => {
      const userId = ensureUserId();
      const request: ApiWithdrawRequest = {
        user_id: userId,
        token: payload.token,
        amount: payload.amount,
        to: payload.to,
      };
      return apiRequest('/withdrawals', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },
    [apiRequest, ensureUserId],
  );

  return {
    login,
    placeOrder,
    cancelOrder,
    getBalances,
    getDepositAddress,
    requestWithdrawal,
    token,
  };
}
