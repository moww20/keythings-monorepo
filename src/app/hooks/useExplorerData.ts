import { useCallback, useEffect, useState } from 'react';

interface ExplorerAccount {
  publicKey: string;
  type: string;
  representative: string | null;
  owner: string | null;
  signers: string[];
  headBlock: string | null;
  info: Record<string, unknown>;
  tokens: Array<{
    publicKey: string;
    name: string | null;
    ticker: string | null;
    decimals: number | null;
    totalSupply: string | null;
    balance: string;
  }>;
  certificates: Array<{
    issuer: string | null;
    hash: string;
    issuedAt: string | null;
    expiresAt: string | null;
  }>;
}

interface ExplorerDataState {
  account: ExplorerAccount | null;
  loading: boolean;
  error: string | null;
}

export function useExplorerData() {
  const [state, setState] = useState<ExplorerDataState>({
    account: null,
    loading: false,
    error: null,
  });

  const fetchAccountInfo = useCallback(async (publicKey: string): Promise<ExplorerAccount | null> => {
    if (typeof window === 'undefined' || !window.keeta) {
      throw new Error('Keeta wallet not available');
    }

    const keeta = window.keeta;
    if (!keeta || !keeta.getAccountInfo) {
      throw new Error('Keeta wallet not available or getAccountInfo method not supported');
    }

    try {
      // Use the wallet extension to get account info
      const accountInfo = await keeta.getAccountInfo(publicKey);
      
      if (!accountInfo) {
        return null;
      }

      // Transform the wallet extension response to our ExplorerAccount format
      const account = accountInfo as any; // Type assertion since we don't know the exact structure
      return {
        publicKey: account.publicKey || publicKey,
        type: account.type || 'ACCOUNT',
        representative: account.representative || null,
        owner: account.owner || null,
        signers: account.signers || [],
        headBlock: account.headBlock || null,
        info: account.info || {},
        tokens: account.tokens || [],
        certificates: account.certificates || [],
      };
    } catch (error) {
      console.error('Error fetching account info:', error);
      throw error;
    }
  }, []);

  const fetchAccount = useCallback(async (publicKey: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const account = await fetchAccountInfo(publicKey);
      setState({
        account,
        loading: false,
        error: account ? null : 'Account not found',
      });
    } catch (error) {
      setState({
        account: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch account',
      });
    }
  }, [fetchAccountInfo]);

  const clearData = useCallback(() => {
    setState({
      account: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    fetchAccount,
    clearData,
  };
}
