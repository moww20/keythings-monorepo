export interface KeetaBalanceEntry {
  token: string;
  balance: string | number | bigint;
  metadata?: string | null;
}

export interface KeetaNetworkInfo {
  chainId?: string | number;
  [key: string]: unknown;
}

export interface KeetaBaseTokenInfo {
  address?: string | null;
  [key: string]: unknown;
}

export interface KeetaProvider {
  isKeeta?: boolean;
  isAvailable?: boolean;
  isConnected?: (() => Promise<boolean>) | boolean;
  isLocked?: () => Promise<boolean>;
  getAccounts: () => Promise<string[]>;
  requestAccounts: () => Promise<string[]>;
  getBalance: (account: string) => Promise<string | number | bigint>;
  getNetwork: () => Promise<KeetaNetworkInfo | null | undefined>;
  getAllBalances: () => Promise<KeetaBalanceEntry[]>;
  getBaseToken: () => Promise<KeetaBaseTokenInfo | null | undefined>;
  getKtaPrice?: () => Promise<{ price: number } | null | undefined>;
  request?: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  requestCapabilities?: (capabilities: string[]) => Promise<unknown>;
  sendTransaction?: (transaction: unknown) => Promise<unknown>;
  switchNetwork?: (network: string) => Promise<void>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  off?: (event: string, listener: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    keeta?: KeetaProvider;
  }
}

export {};
