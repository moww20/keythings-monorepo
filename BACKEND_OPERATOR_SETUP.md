# Backend Operator Account Setup Guide

This document outlines the steps to set up and manage a dedicated backend operator account for the Keeta CEX (Centralized Exchange) implementation. This account is crucial for the backend to perform operations like processing user withdrawals on behalf of user storage accounts, while adhering to the principle of non-custodial user funds.

## 1. Understanding the Architecture

In the Keeta CEX design:
- **User Storage Accounts (`S_user`)**: These are owned by the individual users. Users retain `OWNER` permission and can always self-withdraw their funds.
- **Exchange Operator Account**: This account is owned and controlled by the **backend service** of the exchange. It is granted specific, scoped permissions (e.g., `SEND_ON_BEHALF` for specific tokens to specific destinations) on user storage accounts.

**Key Principle**: The backend operator account should **NEVER** be created or controlled by the user's wallet. It is an internal component of the exchange's backend infrastructure.

## 2. Understanding Keeta Account Keys

Keeta uses **seeds** (hex strings), NOT traditional private keys:
- **Seed**: A hex string used to deterministically generate account key pairs
- **Account Index**: A number used with the seed to derive different accounts from the same seed
- **Generation**: Use `Account.generateRandomSeed({ asString: true })` to create a new seed
- **Derivation**: Use `Account.fromSeed(seed, index)` to create accounts

**Important:** The `.env` file should be in the **`keythings-dapp-engine`** backend folder within the monorepo.

## 3. Generating Backend Operator Seed

**Option 1: Generate a New Seed (Recommended for Production)**

In your backend service, generate a secure random seed:

```typescript
import * as KeetaNet from '@keetanetwork/keetanet-client';

// Generate a secure random seed
const seed = KeetaNet.lib.Account.generateRandomSeed({ asString: true });
console.log("Generated operator seed:", seed);

// Create the operator account (index 0)
const operatorAccount = KeetaNet.lib.Account.fromSeed(seed, 0);
const publicKey = operatorAccount.publicKeyString.toString();
console.log("Operator public key:", publicKey);

// IMPORTANT: Securely store the seed in your backend .env file
```

**Option 2: Use Existing Seed**

If you already have a Keeta seed for your backend operations, you can use it with a specific account index for the operator.

## 4. Configuring Environment Variables (Backend `.env`)

Create a `.env` file in the **`keythings-dapp-engine`** backend folder:

**Steps:**

1.  **Create `.env` file in the backend:**
    ```bash
    cd keythings-dapp-engine
    touch .env # If it doesn't exist (or use the one already created)
    ```

2.  **Add the following variables:**
    ```dotenv
    # Backend Operator Account Configuration
    # This file should NOT be committed to version control.
    
    # Keeta Operator Seed (hex string - NOT a private key)
    # Generate using: KeetaNet.lib.Account.generateRandomSeed({ asString: true })
    KEETA_OPERATOR_SEED=your_generated_hex_seed_here
    
    # Account index to derive from seed (typically 0 for primary operator)
    KEETA_OPERATOR_ACCOUNT_INDEX=0
    
    # Operator Account Metadata
    KEETA_OPERATOR_ACCOUNT_NAME=Exchange Operator Account
    KEETA_OPERATOR_ACCOUNT_DESCRIPTION=Backend operator account for DEX settlement and user fund management
    KEETA_OPERATOR_ACCOUNT_METADATA={"type":"operator","role":"settlement","version":"1.0","capabilities":["SEND_ON_BEHALF","SETTLEMENT","WITHDRAWAL_PROCESSING"]}
    
    # Network Configuration
    KEETA_NETWORK=test  # or 'main' for mainnet
    ```
    
    **IMPORTANT**: 
    - Replace `your_generated_hex_seed_here` with your actual generated seed
    - This seed is **HIGHLY SENSITIVE** - treat it like a master password
    - **NEVER** commit the `.env` file to version control

3.  **Ensure `.env` is in `.gitignore`** (already added to `keythings-dapp-engine/.gitignore`)

## 5. Backend Implementation

The operator account management functions are implemented in the **`keythings-dapp-engine`** Rust backend. The type definitions are in `src/app/lib/backend-operator-creation.ts` for reference.

**Why Backend-Only?**
- Requires seed/keys which must never be exposed to the browser
- Needs access to server-side environment variables (`.env` in `keythings-dapp-engine/`)
- Backend has direct access to the Keeta network for transaction signing
- Protects sensitive operator seed from client-side exposure

**Backend Implementation Example (Rust):**
```rust
// keythings-dapp-engine/src/operator.rs
use std::env;

pub struct BackendOperatorConfig {
    pub seed: String,
    pub account_index: u32,
    pub name: String,
    pub description: String,
    pub metadata: String,
    pub network: String,
}

pub fn load_backend_operator_config() -> Result<BackendOperatorConfig, String> {
    let seed = env::var("KEETA_OPERATOR_SEED")
        .map_err(|_| "KEETA_OPERATOR_SEED must be set in .env file")?;
    
    let account_index = env::var("KEETA_OPERATOR_ACCOUNT_INDEX")
        .unwrap_or_else(|_| "0".to_string())
        .parse::<u32>()
        .unwrap_or(0);
    
    Ok(BackendOperatorConfig {
        seed,
        account_index,
        name: env::var("KEETA_OPERATOR_ACCOUNT_NAME")
            .unwrap_or_else(|_| "Exchange Operator Account".to_string()),
        description: env::var("KEETA_OPERATOR_ACCOUNT_DESCRIPTION")
            .unwrap_or_else(|_| "Backend operator account".to_string()),
        metadata: env::var("KEETA_OPERATOR_ACCOUNT_METADATA")
            .unwrap_or_else(|_| r#"{"type":"operator"}"#.to_string()),
        network: env::var("KEETA_NETWORK")
            .unwrap_or_else(|_| "test".to_string()),
    })
}
```

**Or TypeScript Implementation Example (if using Node.js backend):**
```typescript
// keythings-dapp-engine/services/operator-account.ts
import * as KeetaNet from '@keetanetwork/keetanet-client';
import type { BackendOperatorConfig } from '../types';

export function loadBackendOperatorConfig(): BackendOperatorConfig {
  const seed = process.env.KEETA_OPERATOR_SEED;
  const accountIndex = parseInt(process.env.KEETA_OPERATOR_ACCOUNT_INDEX || '0', 10);
  
  if (!seed) {
    throw new Error('KEETA_OPERATOR_SEED must be set in backend .env file');
  }
  
  return {
    seed,
    accountIndex,
    name: process.env.KEETA_OPERATOR_ACCOUNT_NAME || 'Exchange Operator Account',
    description: process.env.KEETA_OPERATOR_ACCOUNT_DESCRIPTION || 'Backend operator account',
    metadata: process.env.KEETA_OPERATOR_ACCOUNT_METADATA || '{"type":"operator"}',
    network: process.env.KEETA_NETWORK || 'test',
  };
}

export function getOperatorAccount(config: BackendOperatorConfig) {
  // Create account from seed and index
  const account = KeetaNet.lib.Account.fromSeed(config.seed, config.accountIndex);
  const publicKey = account.publicKeyString.toString();
  
  console.info('Using backend operator account', {
    publicKey,
    name: config.name,
    network: config.network,
  });
  
  return account;
}

export function getOperatorPublicKey(config: BackendOperatorConfig): string {
  const account = getOperatorAccount(config);
  return account.publicKeyString.toString();
}
```

## 6. Granting Scoped Permissions on User Storage Accounts

When a user creates a storage account for trading, the backend operator needs `SEND_ON_BEHALF` permission on that specific user's storage account. This permission should be **scoped** to specific tokens and/or target addresses to minimize risk.

**Backend Implementation:**
```typescript
// backend/services/operator-permissions.ts
import * as KeetaNet from '@keetanetwork/keetanet-client';
import type { BackendOperatorConfig } from './types';
import { getOperatorAccount } from './operator-account';

export async function grantOperatorPermissions(
  config: BackendOperatorConfig,
  userStorageAccountAddress: string,
  permissionsToGrant: string[],
  targetTokenAddress?: string,
): Promise<void> {
  // Get operator account from seed
  const operatorAccount = getOperatorAccount(config);
  
  // Create UserClient with operator account
  const client = KeetaNet.UserClient.fromNetwork(config.network, operatorAccount);

  const userStorageAccount = KeetaNet.lib.Account.fromPublicKeyString(userStorageAccountAddress);
  const builder = client.initBuilder();

  builder.updateAccounts({
    signer: operatorAccount,
    account: userStorageAccount,
  });

  const permissions = new KeetaNet.lib.Permissions(permissionsToGrant);
  
  builder.updatePermissions(
    operatorAccount,
    permissions,
    targetTokenAddress ? KeetaNet.lib.Account.fromPublicKeyString(targetTokenAddress) : undefined,
    undefined,
    { account: userStorageAccount },
  );

  await client.publishBuilder(builder);
  console.log(`Granted ${permissionsToGrant.join(',')} on ${userStorageAccountAddress}`);
}

// Example usage in your backend API endpoint
// const config = loadBackendOperatorConfig();
// await grantOperatorPermissions(config, userStorageAddress, ['SEND_ON_BEHALF'], tokenAddress);
```

## 7. Revoking Operator Permissions (Emergency / Cleanup)

In an emergency (e.g., operator seed compromise) or for cleanup, you can revoke the operator's permissions.

**Backend Implementation:**
```typescript
// backend/services/operator-permissions.ts
export async function revokeOperatorPermissions(
  config: BackendOperatorConfig,
  userStorageAccountAddress: string,
  permissionsToRevoke: string[],
  targetTokenAddress?: string,
): Promise<void> {
  // Get operator account from seed
  const operatorAccount = getOperatorAccount(config);
  
  // Create UserClient
  const client = KeetaNet.UserClient.fromNetwork(config.network, operatorAccount);

  const userStorageAccount = KeetaNet.lib.Account.fromPublicKeyString(userStorageAccountAddress);
  const builder = client.initBuilder();

  builder.updateAccounts({
    signer: operatorAccount,
    account: userStorageAccount,
  });

  // To revoke, grant empty permissions
  const emptyPermissions = new KeetaNet.lib.Permissions([]);
  
  builder.updatePermissions(
    operatorAccount,
    emptyPermissions,
    targetTokenAddress ? KeetaNet.lib.Account.fromPublicKeyString(targetTokenAddress) : undefined,
    undefined,
    { account: userStorageAccount },
  );

  await client.publishBuilder(builder);
  console.log(`Revoked ${permissionsToRevoke.join(',')} on ${userStorageAccountAddress}`);
}

// Example usage in your backend API endpoint
// const config = loadBackendOperatorConfig();
// await revokeOperatorPermissions(config, userStorageAddress, ['SEND_ON_BEHALF'], tokenAddress);
```

## 8. Security Considerations

-   **Seed Security**: The `KEETA_OPERATOR_SEED` is **HIGHLY SENSITIVE** - it's like a master password. It must be stored securely (e.g., environment variables, secret management services like AWS Secrets Manager, HashiCorp Vault) and **NEVER** exposed publicly.
-   **Backend-Only**: The `.env` file with the seed should **ONLY** exist in `keythings-dapp-engine/`, **NEVER** in the frontend code or exposed to the browser.
-   **Least Privilege**: Grant only the necessary permissions (`SEND_ON_BEHALF`) and always scope them (e.g., to specific tokens or destination addresses) to limit the blast radius of a compromise.
-   **Monitoring**: Implement robust monitoring for all transactions signed by the operator account.
-   **Emergency Procedures**: Have clear procedures for revoking operator permissions in case of a security incident.
-   **Seed Rotation**: Regularly rotate operator seeds (this requires generating a new seed, deploying it, and updating all user storage account permissions).

## 9. Complete Usage Example

Here's a complete example of setting up and using the backend operator account:

```typescript
// backend/index.ts - Main backend service
import * as KeetaNet from '@keetanetwork/keetanet-client';
import { loadBackendOperatorConfig, getOperatorAccount, getOperatorPublicKey } from './services/operator-account';
import { grantOperatorPermissions, revokeOperatorPermissions } from './services/operator-permissions';

async function main() {
  // 1. Load configuration from backend .env file
  const config = loadBackendOperatorConfig();
  
  // 2. Get operator account and public key
  const operatorAccount = getOperatorAccount(config);
  const operatorPublicKey = getOperatorPublicKey(config);
  console.log(`Operator ready: ${operatorPublicKey}`);
  
  // 3. Example: Grant SEND_ON_BEHALF permission for a specific token
  const userStorageAddress = "keeta_user_storage_address_here";
  const tokenAddress = "keeta_usdx_token_address_here";
  
  await grantOperatorPermissions(
    config,
    userStorageAddress,
    ['SEND_ON_BEHALF'],
    tokenAddress // Scoped to USDX token only
  );
  
  console.log(`Granted SEND_ON_BEHALF permission on ${userStorageAddress} for token ${tokenAddress}`);
}

// Example API endpoint for granting permissions
app.post('/api/grant-operator-permissions', async (req, res) => {
  try {
    const { userStorageAddress, tokenAddress } = req.body;
    const config = loadBackendOperatorConfig();
    
    await grantOperatorPermissions(
      config,
      userStorageAddress,
      ['SEND_ON_BEHALF'],
      tokenAddress
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to grant permissions:', error);
    res.status(500).json({ error: 'Failed to grant permissions' });
  }
});

// Example API endpoint for emergency revocation
app.post('/api/revoke-operator-permissions', async (req, res) => {
  try {
    const { userStorageAddress, tokenAddress } = req.body;
    const config = loadBackendOperatorConfig();
    
    await revokeOperatorPermissions(
      config,
      userStorageAddress,
      ['SEND_ON_BEHALF'],
      tokenAddress
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to revoke permissions:', error);
    res.status(500).json({ error: 'Failed to revoke permissions' });
  }
});

main().catch(console.error);
```

## 10. Summary

By following this guide, you have:

1. ✅ **Understood Keeta's seed-based account system** (not traditional private keys)
2. ✅ **Generated a secure operator seed** for your backend
3. ✅ **Configured environment variables** in your **separate backend deployment** (NOT in monorepo)
4. ✅ **Implemented backend operator functions** for permission management
5. ✅ **Established security best practices** for seed management

**Key Takeaways:**
- The `.env` file lives in **`keythings-dapp-engine/`**, the Rust backend folder
- Keeta uses **seeds** (hex strings), NOT private keys
- Use `Account.fromSeed(seed, index)` to derive accounts
- Always scope permissions to specific tokens/destinations
- Monitor all operator transactions closely
- The backend (`keythings-dapp-engine`) handles all sensitive operations

Your backend operator account is now ready to manage user storage account permissions securely! 🚀