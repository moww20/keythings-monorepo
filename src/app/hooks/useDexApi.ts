'use client';

import { useCallback, useState } from 'react';

import { useWallet } from '@/app/contexts/WalletContext';
import type { OrderRequestPayload } from '@/app/types/trading';

const API_BASE_URL = process.env.NEXT_PUBLIC_DEX_API_URL ?? 'http://localhost:8080';

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

  const login = useCallback(async () => {
    if (!publicKey || !signMessage) {
      throw new Error('Connect and unlock your wallet to continue.');
    }

    if (isAuthenticating && token) {
      return token;
    }

    setIsAuthenticating(true);
    try {
      const challengeResponse = await fetch(`${API_BASE_URL}/auth/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!challengeResponse.ok) {
        throw new Error('Failed to request authentication challenge');
      }

      const { nonce } = await parseJson<{ nonce: string }>(challengeResponse);
      if (!nonce) {
        throw new Error('Authentication challenge is invalid');
      }

      const message = `keeta-login:${nonce}`;
      const signature = await signMessage(message);

      const verifyResponse = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: publicKey,
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
  }, [isAuthenticating, publicKey, signMessage, token]);

  const apiRequest = useCallback(
    async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
      let authToken = token;

      if (!authToken) {
        authToken = await login();
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
    (order: OrderRequestPayload) =>
      apiRequest('/orders/place', {
        method: 'POST',
        body: JSON.stringify(order),
      }),
    [apiRequest],
  );

  const cancelOrder = useCallback(
    (orderId: string) =>
      apiRequest('/orders/cancel', {
        method: 'POST',
        body: JSON.stringify({ id: orderId }),
      }),
    [apiRequest],
  );

  const getBalances = useCallback(() => apiRequest('/balances'), [apiRequest]);

  const getDepositAddress = useCallback(() => apiRequest('/deposits/address'), [apiRequest]);

  const requestWithdrawal = useCallback(
    (payload: { asset: string; amount: string; destination: string }) =>
      apiRequest('/withdrawals/request', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    [apiRequest],
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
