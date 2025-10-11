import type {
  KeetaAccountRef,
  KeetaBuilder,
  KeetaBuilderPublishResult,
  KeetaPermissionDescriptor,
  KeetaPublicKeyLike,
  KeetaUserClient,
} from "@/types/keeta";

function isPublicKeyLike(value: unknown): value is KeetaPublicKeyLike {
  return Boolean(value) && typeof (value as KeetaPublicKeyLike).toString === "function";
}

function normalizePublicKeyString(value: unknown): string | null {
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

  if (candidate && isPublicKeyLike(candidate)) {
    return candidate.toString();
  }

  if (isPublicKeyLike(value)) {
    return value.toString();
  }

  return null;
}

function createPermissionPayload(flags: string[]): KeetaPermissionDescriptor {
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

function normalizeAccountRef(value: unknown): KeetaAccountRef {
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

function extractBlockHash(result: KeetaBuilderPublishResult | null | undefined): string | null {
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

  async createStorageAccount(exchangeOperatorPubkey: string, allowedTokens: string[]): Promise<string> {
    if (!exchangeOperatorPubkey || typeof exchangeOperatorPubkey !== "string") {
      throw new Error("exchangeOperatorPubkey must be a non-empty string");
    }

    const builder = this.userClient.initBuilder();
    if (!builder) {
      throw new Error("User client did not return a builder instance");
    }

    const storageAccount = await this.generateStorageAccount(builder);
    await this.invokeIfAvailable(builder, ["computeBlocks"]);
    await this.setStorageAccountDefaults(builder, storageAccount);

    const operatorAccount = normalizeAccountRef(exchangeOperatorPubkey);
    for (const token of allowedTokens) {
      try {
        const tokenAccount = normalizeAccountRef(token);
        await this.grantSendOnBehalf(builder, operatorAccount, tokenAccount, storageAccount);
      } catch (error) {
        console.warn("StorageAccountManager: skipping token permission due to invalid token reference", token, error);
      }
    }

    const receipt = await this.userClient.publishBuilder(builder);
    const publishedAccount =
      extractAccount(receipt?.account) ?? (receipt?.accounts ? extractAccount(receipt.accounts[0]) : null) ?? storageAccount;

    const publicKey = normalizePublicKeyString(publishedAccount);
    if (!publicKey) {
      throw new Error("Failed to resolve storage account public key after publishing");
    }

    return publicKey;
  }

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

    const metadata = {
      name: "DEX Storage Account",
      description: "Storage account for hybrid DEX operations",
      metadata: JSON.stringify({ created: Date.now(), type: "dex" }),
      defaultPermission: createPermissionPayload(["STORAGE_DEPOSIT", "STORAGE_CAN_HOLD"]),
    } satisfies Record<string, unknown>;

    await Promise.resolve(setInfo(metadata, { account: storageAccount }));
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
