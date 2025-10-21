import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type KeetaNetworkName = 'test' | 'main' | 'staging' | 'dev';

type VoteStaple = Record<string, unknown>;

type ChainBlock = Record<string, unknown>;

export interface LedgerHistoryResponse {
  account: string;
  network: KeetaNetworkName;
  items: Array<{
    stapleHash?: string;
    producer?: string | null;
    timestamp?: number | null;
    operationsCount?: number;
  }>;
  relevantOps?: Array<{
    type?: string;
    from?: string | null;
    to?: string | null;
    amount?: string | null;
    token?: string | null;
    timestamp?: number | null;
  }>;
}

export interface LedgerChainResponse {
  account: string;
  network: KeetaNetworkName;
  items: Array<{
    hash?: string;
    previous?: string | null;
    timestamp?: number | null;
    operationsCount?: number;
  }>;
}

export interface LedgerOperationsResponse {
  account: string;
  network: KeetaNetworkName;
  items: Array<{
    type?: string;
    from?: string | null;
    to?: string | null;
    amount?: string | null;
    token?: string | null;
    timestamp?: number | null;
  }>;
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly config: ConfigService) {}

  private resolveNetwork(): KeetaNetworkName {
    const raw = (this.config.get<string>('KEETA_NETWORK') || 'test').toLowerCase();
    if (raw === 'main' || raw === 'mainnet') return 'main';
    if (raw === 'staging') return 'staging';
    if (raw === 'dev' || raw === 'development') return 'dev';
    return 'test';
  }

  private async toAccountFromPublicKey(publicKey: string): Promise<unknown> {
    try {
      this.logger.log(`Creating account from public key: ${publicKey.substring(0, 20)}...`);
      
      if (!publicKey || typeof publicKey !== 'string') {
        throw new Error('Invalid public key provided');
      }

      // Dynamic import to avoid initialization issues
      const KeetaNet = await import('@keetanetwork/keetanet-client');
      const maybe = (KeetaNet as any)?.lib?.Account?.fromPublicKeyString?.(publicKey);
      if (maybe && typeof (maybe as any).then === 'function') {
        const account = await maybe;
        this.logger.log(`Successfully created account from public key`);
        return account;
      }
      
      this.logger.log(`Account created synchronously`);
      return maybe;
    } catch (error) {
      this.logger.error(`Error creating account from public key ${publicKey.substring(0, 20)}...:`, error);
      throw new Error(`Failed to create account from public key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getClient(account?: unknown) {
    try {
      this.logger.log(`Creating Keeta client for network: ${this.resolveNetwork()}`);
      
      // Dynamic import to avoid initialization issues
      const KeetaNet = await import('@keetanetwork/keetanet-client');
      const network = this.resolveNetwork();
      const factory = (KeetaNet as any)?.UserClient?.fromNetwork;
      
      if (typeof factory !== 'function') {
        throw new Error('KeetaNet.UserClient.fromNetwork is unavailable');
      }
      
      let client;
      if (account) {
        this.logger.log(`Creating read-only client with account for querying`);
        // Use null as signer and pass account in options for read-only operations
        client = factory(network, null, { account });
      } else {
        this.logger.log(`Creating client without account`);
        client = factory(network, null);
      }
      
      this.logger.log(`Successfully created Keeta client`);
      return client;
    } catch (error) {
      this.logger.error(`Error creating Keeta client:`, error);
      throw new Error(`Failed to create Keeta client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getHistory(publicKey: string, limit?: number, includeOps?: boolean): Promise<LedgerHistoryResponse> {
    this.logger.log(`Getting history for account: ${publicKey}`);
    
    // Add timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Keeta SDK timeout after 60 seconds')), 60000);
    });

    const historyPromise = this.fetchHistoryData(publicKey, limit, includeOps);
    
    const result = await Promise.race([historyPromise, timeoutPromise]);
    
    this.logger.log(`Successfully retrieved history for ${publicKey}`);
    return result;
  }

  private async fetchHistoryData(publicKey: string, limit?: number, includeOps?: boolean): Promise<LedgerHistoryResponse> {
    this.logger.log(`[FETCH_HISTORY] Starting fetch for account: ${publicKey.substring(0, 20)}...`);
    
    // Use direct Keeta SDK calls instead of the complex service methods
    this.logger.log(`[FETCH_HISTORY] Using direct Keeta SDK calls...`);
    
    const KeetaNet = await import('@keetanetwork/keetanet-client');
    const account = await KeetaNet.lib.Account.fromPublicKeyString(publicKey);
    this.logger.log(`[FETCH_HISTORY] Account created successfully`);
    
    const client = KeetaNet.UserClient.fromNetwork('test', null, { account });
    this.logger.log(`[FETCH_HISTORY] Client created successfully`);

    this.logger.log(`[FETCH_HISTORY] Network: ${this.resolveNetwork()}`);
    this.logger.log(`[FETCH_HISTORY] Client methods available: ${Object.keys(client).join(', ')}`);
    
    // Check if history method exists
    if (typeof client.history !== 'function') {
      this.logger.warn('[FETCH_HISTORY] Client history method not available');
      return {
        account: publicKey,
        network: this.resolveNetwork(),
        items: [],
        relevantOps: [],
      };
    }

    this.logger.log('Calling client.history()...');
    const rawHistory = await client.history();
    this.logger.log(`Raw history result type: ${typeof rawHistory}, isArray: ${Array.isArray(rawHistory)}`);
    
    const staples: VoteStaple[] = Array.isArray(rawHistory) ? rawHistory : [];
    this.logger.log(`Processed staples count: ${staples.length}`);

    const sliced = typeof limit === 'number' ? staples.slice(0, Math.max(1, Math.min(100, limit))) : staples;
    this.logger.log(`Sliced staples count: ${sliced.length}`);

    const items = sliced.map((staple) => this.mapStaple(staple));
    this.logger.log(`Mapped items count: ${items.length}`);

        let relevantOps: LedgerHistoryResponse['relevantOps'] | undefined;
        if (includeOps) {
          this.logger.log('Attempting to filter operations...');
          const filterFn = (client as any)?.filterStapleOperations;
          if (typeof filterFn === 'function') {
            this.logger.log('Calling filterStapleOperations...');
            try {
              const ops = await filterFn(staples, account);
              const opsArray: unknown[] = Array.isArray(ops) ? ops : [];
              this.logger.log(`Filtered operations count: ${opsArray.length}`);
              relevantOps = opsArray.map((op) => this.mapOperation(op));
            } catch (filterError) {
              this.logger.warn('filterStapleOperations failed, skipping operation filtering:', filterError);
              relevantOps = [];
            }
          } else {
            this.logger.warn('filterStapleOperations method not available, skipping operation filtering');
            relevantOps = [];
          }
        }

    this.logger.log(`Final result - items: ${items.length}, relevantOps: ${relevantOps?.length || 0}`);
    return {
      account: publicKey,
      network: this.resolveNetwork(),
      items,
      relevantOps,
    };
  }

  async getChain(publicKey: string, limit?: number): Promise<LedgerChainResponse> {
    this.logger.log(`Getting chain for account: ${publicKey}`);
    
    const account = await this.toAccountFromPublicKey(publicKey);
    const client = await this.getClient(account);

    const rawChain = await (client.chain?.() ?? Promise.resolve([]));
    const blocks: ChainBlock[] = Array.isArray(rawChain) ? rawChain : [];

    const sliced = typeof limit === 'number' ? blocks.slice(0, Math.max(1, Math.min(100, limit))) : blocks;

    const items = sliced.map((block) => this.mapBlock(block));

    this.logger.log(`Successfully retrieved chain for ${publicKey}`);
    return {
      account: publicKey,
      network: this.resolveNetwork(),
      items,
    };
  }

  async getOperations(publicKey: string, limit?: number): Promise<LedgerOperationsResponse> {
    this.logger.log(`Getting operations for account: ${publicKey}`);
    
    const account = await this.toAccountFromPublicKey(publicKey);
    const client = await this.getClient(account);

    const rawHistory = await (client.history?.() ?? Promise.resolve([]));
    const staples: VoteStaple[] = Array.isArray(rawHistory) ? rawHistory : [];

    // Try to get operations from blocks directly instead of using filterStapleOperations
    const operations: unknown[] = [];
    
    for (const staple of staples) {
      const blocks = Array.isArray(staple.blocks) ? staple.blocks : [];
      for (const block of blocks) {
        const blockOps = Array.isArray(block.operations) ? block.operations : [];
        operations.push(...blockOps);
      }
    }

    const mapped = operations.map((op) => this.mapOperation(op));
    const sliced = typeof limit === 'number' ? mapped.slice(0, Math.max(1, Math.min(100, limit))) : mapped;

    this.logger.log(`Successfully retrieved operations for ${publicKey}`);
    return {
      account: publicKey,
      network: this.resolveNetwork(),
      items: sliced,
    };
  }

  async getBalance(publicKey: string): Promise<{ account: string; network: string; balance: string; allBalances: any[] }> {
    this.logger.log(`Getting balance for account: ${publicKey}`);
    
    const account = await this.toAccountFromPublicKey(publicKey);
    const client = await this.getClient(account);

    // Get all token balances using allBalances() method
    const allBalances = await client.allBalances();
    this.logger.log(`All balances for ${publicKey}:`, allBalances);

    // Get base token balance
    const state = await client.state({ account });
    const baseBalance = state.balance?.toString() ?? '0';

    // Convert BigInt values to strings for JSON serialization
    const serializedBalances = allBalances.map((balance: any) => ({
      token: balance.token?.publicKeyString?.toString() || 'unknown',
      balance: balance.balance?.toString() || '0'
    }));

    this.logger.log(`Successfully retrieved balance for ${publicKey}: base=${baseBalance}, allBalances=${serializedBalances.length} tokens`);
    return {
      account: publicKey,
      network: this.resolveNetwork(),
      balance: baseBalance,
      allBalances: serializedBalances,
    };
  }

  private mapStaple(staple: unknown) {
    const r = this.toRecord(staple);
    
    // Extract timestamp from the staple (using date property)
    const timestamp = r.date instanceof Date ? r.date.getTime() : this.toNumberOrNull(r.timestamp);
    
    // Extract producer/hash information
    const producer = this.toString(r.blocksHash, undefined) ?? this.toString(r.hash, undefined) ?? null;
    
    // Count operations in the staple blocks
    const blocks = Array.isArray(r.blocks) ? r.blocks : [];
    const operationsCount = blocks.reduce((total, block) => {
      const blockOps = Array.isArray(block.operations) ? block.operations : [];
      return total + blockOps.length;
    }, 0);
    
    return {
      stapleHash: this.toString(r.blocksHash, undefined) ?? this.toString(r.hash, undefined) ?? undefined,
      producer,
      timestamp,
      operationsCount,
    };
  }

  private mapBlock(block: unknown) {
    const r = this.toRecord(block);
    const ops = Array.isArray(r.operations) ? r.operations : [];
    return {
      hash: this.toString(r.hash, undefined) ?? undefined,
      previous: this.toString(r.previousBlock, undefined) ?? null,
      timestamp: this.toNumberOrNull(r.timestamp),
      operationsCount: ops.length,
    };
  }

  private mapOperation(op: unknown) {
    const r = this.toRecord(op);
    return {
      type: this.toString(r.type, undefined) ?? undefined,
      from: this.toString(r.from, undefined) ?? null,
      to: this.toString(r.to, undefined) ?? null,
      amount: this.toString(r.amount, undefined) ?? null,
      token: this.toString(r.token ?? r.tokenAddress, undefined) ?? null,
      timestamp: this.toNumberOrNull(r.timestamp),
    };
  }

  private toRecord<T extends Record<string, unknown>>(value: unknown): T {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as T;
    return {} as T;
  }

  private toString(value: unknown, fallback: string | undefined): string | undefined {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'bigint') return value.toString();
    return fallback;
  }

  private toNumberOrNull(value: unknown): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
}
