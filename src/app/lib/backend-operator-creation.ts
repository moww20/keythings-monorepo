/**
 * Backend Operator Account Management
 * 
 * This file contains type definitions and documentation for backend operator configuration.
 * These functions are intended to be used by the backend service, not the client-side application.
 * 
 * IMPORTANT: This file is for documentation and type definitions only. The actual implementation
 * is in the NestJS backend where environment variables are accessible.
 */

export interface BackendOperatorConfig {
  seed: string;          // Hex seed string for Keeta account (NOT a private key)
  accountIndex: number;  // Account index to derive from seed (typically 0 for operator)
  name: string;
  description: string;
  metadata: string;
  network: string;       // 'test' or 'main'
}

/**
 * Loads backend operator configuration from environment variables.
 * Throws an error if required environment variables are not set.
 * 
 * NOTE: This function should only be called from the backend service.
 */
export function loadBackendOperatorConfig(): BackendOperatorConfig {
  const seed = process.env.KEETA_OPERATOR_SEED;
  const accountIndex = parseInt(process.env.KEETA_OPERATOR_ACCOUNT_INDEX || '0', 10);
  const name = process.env.KEETA_OPERATOR_ACCOUNT_NAME || 'Exchange Operator Account';
  const description = process.env.KEETA_OPERATOR_ACCOUNT_DESCRIPTION || 'Backend operator account for DEX settlement';
  const metadata = process.env.KEETA_OPERATOR_ACCOUNT_METADATA || '{"type":"operator","role":"settlement"}';
  const network = process.env.KEETA_NETWORK || 'test';

  if (!seed) {
    throw new Error(
      'Backend operator seed not configured. Please set KEETA_OPERATOR_SEED in your backend .env file',
    );
  }

  return { seed, accountIndex, name, description, metadata, network };
}

/**
 * Gets the operator account from the seed.
 * This function should be implemented in your backend service.
 * 
 * Example backend implementation:
 * ```typescript
 * import * as KeetaNet from '@keetanetwork/keetanet-client';
 * 
 * export function getOperatorAccount(config: BackendOperatorConfig) {
 *   const account = KeetaNet.lib.Account.fromSeed(config.seed, config.accountIndex);
 *   const publicKey = account.publicKeyString.toString();
 *   
 *   console.info('Using backend operator account', {
 *     publicKey,
 *     name: config.name,
 *     network: config.network,
 *   });
 * 
 *   return account;
 * }
 * ```
 */
export type GetOperatorAccountFunction = (config: BackendOperatorConfig) => unknown; // Returns KeetaNet.Account in backend

/**
 * NOTE: The following functions are placeholders for backend implementation.
 * 
 * To implement these functions in your backend service:
 * 
 * 1. Install @keetanetwork/keetanet-client in your backend
 * 2. Create a server-side API endpoint that calls these functions
 * 3. Use the Keeta SDK to interact with the network
 * 
 * Example backend implementation:
 * 
 * ```typescript
 * import * as KeetaNet from '@keetanetwork/keetanet-client';
 * 
 * export async function grantOperatorPermissions(
 *   config: BackendOperatorConfig,
 *   userStorageAccountAddress: string,
 *   operatorAccountAddress: string,
 *   permissionsToGrant: string[],
 *   targetTokenAddress?: string,
 * ): Promise<void> {
 *   // Create Account instances from private/public keys
 *   const operatorAccount = KeetaNet.lib.Account.fromPrivateKey(config.privateKey);
 *   
 *   // Create UserClient with operator account
 *   const networkId = config.network === 'main' ? BigInt(1) : BigInt(0);
 *   const client = new KeetaNet.UserClient({
 *     network: networkId,
 *     account: operatorAccount,
 *   });
 * 
 *   const userStorageAccount = KeetaNet.lib.Account.fromPublicKeyString(userStorageAccountAddress);
 *   const builder = client.initBuilder();
 * 
 *   builder.updateAccounts({
 *     signer: operatorAccount,
 *     account: userStorageAccount,
 *   });
 * 
 *   const permissions = new KeetaNet.lib.Permissions(permissionsToGrant);
 *   
 *   builder.updatePermissions(
 *     operatorAccount,
 *     permissions,
 *     targetTokenAddress ? KeetaNet.lib.Account.fromPublicKeyString(targetTokenAddress) : undefined,
 *     undefined,
 *     { account: userStorageAccount },
 *   );
 * 
 *   await client.publishBuilder(builder);
 * }
 * ```
 */

// Placeholder type exports for documentation
export type GrantOperatorPermissionsFunction = (
  config: BackendOperatorConfig,
  userStorageAccountAddress: string,
  operatorAccountAddress: string,
  permissionsToGrant: string[],
  targetTokenAddress?: string,
) => Promise<void>;

export type RevokeOperatorPermissionsFunction = (
  config: BackendOperatorConfig,
  userStorageAccountAddress: string,
  operatorAccountAddress: string,
  permissionsToRevoke: string[],
  targetTokenAddress?: string,
) => Promise<void>;
