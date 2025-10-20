import { useEffect, useState } from 'react';
import { accountApi, storageApi, tokenApi, transactionApi, networkApi } from '@/lib/api/client';

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
        const data = await storageApi.getStorage(publicKey);
        setStorage(data);
      } catch (err) {
        console.error('Failed to fetch storage:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch storage'));
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
