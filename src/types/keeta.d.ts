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

export interface KeetaPublicKeyLike {
  toString(): string;
}

export interface KeetaAccountRef {
  publicKeyString: string | KeetaPublicKeyLike;
  [key: string]: unknown;
}

export interface KeetaPermissionDescriptor {
  base?: { flags?: string[] };
  [key: string]: unknown;
}

export interface KeetaACLRecord {
  entity: KeetaAccountRef;
  principal: KeetaAccountRef;
  permissions: KeetaPermissionDescriptor;
  target?: KeetaAccountRef | null;
  [key: string]: unknown;
}

export interface KeetaBuilderPublishResult {
  account?: KeetaAccountRef | null;
  accounts?: KeetaAccountRef[] | null;
  blocks?: Array<{ hash?: string | KeetaPublicKeyLike | null }> | null;
  [key: string]: unknown;
}

export interface KeetaBuilder {
  generateIdentifier?: (...args: unknown[]) => Promise<{ account: KeetaAccountRef }> | { account: KeetaAccountRef };
  generateStorageAccount?: () => Promise<KeetaAccountRef> | KeetaAccountRef;
  createStorageAccount?: () => Promise<KeetaAccountRef> | KeetaAccountRef;
  computeBlocks?: () => Promise<void> | void;
  setInfo?: (info: Record<string, unknown>, context?: Record<string, unknown>) => Promise<void> | void;
  updatePermissions?: (...args: unknown[]) => Promise<void> | void;
  send?: (...args: unknown[]) => Promise<void> | void;
  [key: string]: unknown;
}

export interface KeetaUserClient {
  initBuilder: () => KeetaBuilder;
  publishBuilder: (builder: KeetaBuilder) => Promise<KeetaBuilderPublishResult>;
  listACLsByPrincipal?: (params?: Record<string, unknown>) => Promise<KeetaACLRecord[]>;
  listACLsByEntity?: (params: { account: KeetaAccountRef }) => Promise<KeetaACLRecord[]>;
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
  signMessage?: (message: string) => Promise<string>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  off?: (event: string, listener: (...args: unknown[]) => void) => void;
  createUserClient?: () => KeetaUserClient | Promise<KeetaUserClient>;
  getUserClient?: () => KeetaUserClient | Promise<KeetaUserClient>;
  listStorageAccounts?: () => Promise<KeetaACLRecord[]>;
  getAccountInfo?: (address: string) => Promise<unknown>;
  history?: (options?: { depth?: number; cursor?: string }) => Promise<{ records: any[]; cursor: string | null; hasMore: boolean }>;
}

declare global {
  interface Window {
    keeta?: KeetaProvider;
  }
}

export {};
