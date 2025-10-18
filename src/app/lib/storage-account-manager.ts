import type {
  KeetaAccountRef,
  KeetaBuilder,
  KeetaBuilderPublishResult,
  KeetaPermissionDescriptor,
  KeetaPublicKeyLike,
  KeetaUserClient,
} from "@/types/keeta";
import type { RFQStorageAccountDetails, RFQStorageCreationResult } from '@/app/types/rfq-blockchain';
import { toBaseUnits } from './token-utils';
import { encodeToBase64 } from './encoding';

function isPublicKeyLike(value: unknown): value is KeetaPublicKeyLike {
  return Boolean(value) && typeof (value as KeetaPublicKeyLike).toString === "function";
}

export function normalizePublicKeyString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = (value as { publicKeyString?: unknown }).publicKeyString;
  if (typeof candidate === "string") {
    return candidate;
  }

  // Handle SDK objects with .get() or .toString() methods
  if (candidate && typeof candidate === "object") {
    // Try .get() method (for Keeta SDK PublicKey objects)
    if ("get" in candidate) {
      try {
        const getFn = (candidate as { get?: unknown }).get;
        if (typeof getFn === "function") {
          const result = getFn.call(candidate);
          if (typeof result === "string") {
            return result;
          }
        }
      } catch {
        // Continue to next method
      }
    }
    
    // Try .toString() method
    if (isPublicKeyLike(candidate)) {
      try {
        return candidate.toString();
      } catch {
        // Continue
      }
    }
  }

  // Try toString on the value itself
  if (isPublicKeyLike(value)) {
    try {
      return value.toString();
    } catch {
      // Continue
    }
  }

  return null;
}

export function createPermissionPayload(flags: string[]): KeetaPermissionDescriptor {
  const uniqueFlags = Array.from(
    new Set(
      flags
        .map((flag) => (typeof flag === "string" ? flag.trim() : ""))
        .filter((flag) => flag.length > 0),
    ),
  );

  return {
    base: {
      flags: uniqueFlags,
    },
  };
}

export function normalizeAccountRef(value: unknown): KeetaAccountRef {
  if (typeof value === "string") {
    return { publicKeyString: value };
  }

  if (!value || typeof value !== "object") {
    throw new Error("Unable to normalize account reference: value is not an object or string");
  }

  const account = value as KeetaAccountRef;
  if (account.publicKeyString) {
    return account;
  }

  const publicKey = normalizePublicKeyString(value);
  if (publicKey) {
    return { ...account, publicKeyString: publicKey };
  }

  throw new Error("Unable to normalize account reference: missing publicKeyString");
}

/**
 * Serialize account ref to a plain object safe for Chrome messaging.
 * This ensures no methods or circular references exist.
 */
export function serializeAccountRef(value: unknown): KeetaAccountRef {
  const normalized = normalizeAccountRef(value);
  // Create a fresh plain object with only the publicKeyString property
  return { publicKeyString: normalized.publicKeyString };
}

function extractAccount(value: unknown): KeetaAccountRef | null {
  if (!value) {
    return null;
  }

  if (typeof value === "object" && value) {
    if ((value as { account?: unknown }).account) {
      try {
        return normalizeAccountRef((value as { account: unknown }).account);
      } catch {
        // Fall through to other heuristics
      }
    }

    try {
      return normalizeAccountRef(value);
    } catch {
      return null;
    }
  }

  if (typeof value === "string") {
    return { publicKeyString: value };
  }

  return null;
}

export function extractBlockHash(result: KeetaBuilderPublishResult | null | undefined): string | null {
  if (!result?.blocks) {
    return null;
  }

  for (const block of result.blocks) {
    const hash = block?.hash;
    if (!hash) continue;
    if (typeof hash === "string") {
      return hash;
    }
    if (isPublicKeyLike(hash)) {
      return hash.toString();
    }
  }

  return null;
}

export class StorageAccountManager {
  private readonly userClient: KeetaUserClient;

  constructor(userClient: KeetaUserClient) {
    if (!userClient || typeof userClient.initBuilder !== "function" || typeof userClient.publishBuilder !== "function") {
      throw new Error("StorageAccountManager requires a user client with builder capabilities");
    }
    this.userClient = userClient;
  }

  async createStorageAccount(exchangeOperatorPubkey: string | null, allowedTokens: string[]): Promise<string> {
    console.log('Creating storage account...');

    const builder = this.userClient.initBuilder();
    if (!builder) {
      throw new Error("User client did not return a builder instance");
    }

    const storageAccount = await this.generateStorageAccount(builder);
    await this.invokeIfAvailable(builder, ["computeBuilderBlocks", "computeBlocks"]);
    await this.setStorageAccountDefaults(builder, storageAccount);

    // Filter out placeholder values before processing
    const isValidAddress = (addr: string) => 
      addr && !addr.startsWith('PLACEHOLDER_') && addr.length > 10;

    const hasOperator = typeof exchangeOperatorPubkey === "string" && isValidAddress(exchangeOperatorPubkey);

    // Only grant permissions if we have a valid operator address
    if (hasOperator) {
      const operatorAccount = normalizeAccountRef(exchangeOperatorPubkey as string);
      
      for (const token of allowedTokens) {
        if (!isValidAddress(token)) {
          console.log('Skipping placeholder token:', token);
          continue;
        }
        
        try {
          const tokenAccount = normalizeAccountRef(token);
          await this.grantSendOnBehalf(builder, operatorAccount, tokenAccount, storageAccount);
        } catch (error) {
          console.warn("Skipping token permission due to error:", token, error);
        }
      }
    } else {
      console.log('Skipping permission grants - no exchange operator configured');
    }

    const receipt = await this.userClient.publishBuilder(builder);
    console.log('[StorageAccountManager] Receipt from publishBuilder:', JSON.stringify(receipt, null, 2));
    console.log('[StorageAccountManager] storageAccount (fallback):', JSON.stringify(storageAccount, null, 2));
    
    // Handle case where receipt is a string (the account address directly)
    let publishedAccount;
    if (typeof receipt === 'string') {
      console.log('[StorageAccountManager] Receipt is a string, using it directly as the account');
      publishedAccount = { publicKeyString: receipt };
    } else {
      publishedAccount =
        extractAccount(receipt?.account) ?? (receipt?.accounts ? extractAccount(receipt.accounts[0]) : null) ?? storageAccount;
    }
    
    console.log('[StorageAccountManager] publishedAccount after extraction:', JSON.stringify(publishedAccount, null, 2));

    const publicKey = normalizePublicKeyString(publishedAccount);
    console.log('[StorageAccountManager] Final public key:', publicKey);
    
    if (!publicKey) {
      throw new Error("Failed to resolve storage account public key after publishing");
    }
    
    // Check if we got a placeholder
    if (publicKey === '_PLACEHOLDER_' || publicKey.startsWith('PLACEHOLDER_')) {
      console.error('[StorageAccountManager] ❌ Got placeholder instead of real public key!');
      console.error('[StorageAccountManager] Receipt:', receipt);
      console.error('[StorageAccountManager] This means the wallet extension did not return the created account properly');
      throw new Error("Wallet extension returned placeholder instead of real storage account address");
    }

    console.log('Storage account created:', publicKey);
    return publicKey;
  }

  // createRfqStorageAccount method removed - use two-step pattern instead:
  // Step 1: createStorageAccount() - creates empty storage account only
  // Step 2: separate transaction with setInfo() + send() - configures and funds

  async grantTokenPermission(storageAccountPubkey: string, operatorPubkey: string, tokenPubkey: string): Promise<void> {
    const builder = this.userClient.initBuilder();
    if (!builder) {
      throw new Error("User client did not return a builder instance");
    }

    const storageAccount = normalizeAccountRef(storageAccountPubkey);
    const operatorAccount = normalizeAccountRef(operatorPubkey);
    const tokenAccount = normalizeAccountRef(tokenPubkey);

    await this.updatePermissions(builder, operatorAccount, tokenAccount, storageAccount, ["SEND_ON_BEHALF"]);
    await this.userClient.publishBuilder(builder);
  }

  async revokeOperatorPermissions(storageAccountPubkey: string, operatorPubkey: string): Promise<void> {
    const builder = this.userClient.initBuilder();
    if (!builder) {
      throw new Error("User client did not return a builder instance");
    }

    const storageAccount = normalizeAccountRef(storageAccountPubkey);
    const operatorAccount = normalizeAccountRef(operatorPubkey);

    await this.updatePermissions(builder, operatorAccount, null, storageAccount, []);
    await this.userClient.publishBuilder(builder);
  }

  async selfWithdraw(
    storageAccountPubkey: string,
    destinationPubkey: string,
    tokenPubkey: string,
    amount: bigint,
  ): Promise<string> {
    if (typeof amount !== "bigint") {
      throw new Error("Amount must be provided as a bigint value");
    }

    const builder = this.userClient.initBuilder();
    if (!builder) {
      throw new Error("User client did not return a builder instance");
    }

    const storageAccount = normalizeAccountRef(storageAccountPubkey);
    const destinationAccount = normalizeAccountRef(destinationPubkey);
    const tokenAccount = normalizeAccountRef(tokenPubkey);

    const sendFn = this.getMethod(builder, ["send"]);
    if (!sendFn) {
      throw new Error("Builder does not support send operations");
    }

    await Promise.resolve(
      sendFn(destinationAccount, amount, {
        token: tokenAccount,
        account: storageAccount,
      }),
    );

    const receipt = await this.userClient.publishBuilder(builder);
    const hash = extractBlockHash(receipt);
    if (!hash) {
      throw new Error("User client did not return a block hash for the withdrawal");
    }

    return hash;
  }

  private async generateStorageAccount(builder: KeetaBuilder): Promise<KeetaAccountRef> {
    const strategies: Array<[string, unknown[]]> = [
      ["generateStorageAccount", []],
      ["createStorageAccount", []],
      ["generateIdentifier", ["STORAGE"]],
    ];

    for (const [method, args] of strategies) {
      const fn = this.getMethod(builder, [method]);
      if (!fn) continue;

      const result = await Promise.resolve(fn(...args));
      const account = extractAccount(result);
      if (account) {
        return account;
      }
    }

    throw new Error("Builder does not provide a way to generate storage accounts");
  }

  private async setStorageAccountDefaults(builder: KeetaBuilder, storageAccount: KeetaAccountRef): Promise<void> {
    const setInfo = this.getMethod(builder, ["setInfo", "info"]);
    if (!setInfo) {
      console.warn("StorageAccountManager: builder is missing setInfo/info method, skipping metadata configuration");
      return;
    }

    // Encode metadata as base64 (Keeta SDK requires base64 format)
    const metadataJson = JSON.stringify({ created: Date.now(), type: "dex" });
    const metadataBase64 = encodeToBase64(metadataJson);
    
    const metadata = {
      name: "DEX_STORAGE_ACCOUNT",
      description: "Storage account for hybrid DEX operations",
      metadata: metadataBase64,
      defaultPermission: createPermissionPayload(["STORAGE_DEPOSIT", "STORAGE_CAN_HOLD"]),
    } satisfies Record<string, unknown>;

    await Promise.resolve(setInfo(metadata, { account: storageAccount }));
  }

  private encodeMetadata(data: Record<string, unknown>): string {
    const json = JSON.stringify(data);
    return encodeToBase64(json);
  }

  private async grantSendOnBehalf(
    builder: KeetaBuilder,
    operatorAccount: KeetaAccountRef,
    tokenAccount: KeetaAccountRef,
    storageAccount: KeetaAccountRef,
  ): Promise<void> {
    await this.updatePermissions(builder, operatorAccount, tokenAccount, storageAccount, ["SEND_ON_BEHALF"]);
  }

  private async updatePermissions(
    builder: KeetaBuilder,
    operatorAccount: KeetaAccountRef,
    tokenAccount: KeetaAccountRef | null,
    storageAccount: KeetaAccountRef,
    flags: string[],
  ): Promise<void> {
    const updatePermissions = this.getMethod(builder, ["updatePermissions"]);
    if (!updatePermissions) {
      throw new Error("Builder does not support permission updates");
    }

    const permissionPayload = createPermissionPayload(flags);
    const args: unknown[] = [operatorAccount, permissionPayload];

    if (tokenAccount) {
      args.push(tokenAccount);
    } else {
      args.push(undefined);
    }

    args.push(undefined);
    args.push({ account: storageAccount });

    await Promise.resolve(updatePermissions(...args));
  }

  private async invokeIfAvailable(builder: KeetaBuilder, methods: string[]): Promise<void> {
    const fn = this.getMethod(builder, methods);
    if (!fn) {
      return;
    }
    await Promise.resolve(fn());
  }

  private getMethod(builder: KeetaBuilder, methodNames: string[]): ((...args: unknown[]) => unknown) | null {
    for (const name of methodNames) {
      const candidate = (builder as Record<string, unknown>)[name];
      if (typeof candidate === "function") {
        return candidate.bind(builder);
      }
    }
    return null;
  }
}

export default StorageAccountManager;
