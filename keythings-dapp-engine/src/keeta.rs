use log::{info, warn};
use uuid::Uuid;

use crate::models::{DepositAddress, WithdrawRequest};

#[derive(thiserror::Error, Debug)]
pub enum KeetaError {
    #[error("keeta operation failed: {0}")]
    #[allow(dead_code)]
    Operation(String),
}

#[derive(Clone)]
pub struct KeetaClient {
    // No RPC URL needed - Keeta uses direct SDK calls
    // Frontend wallet handles all SDK interactions
}

impl KeetaClient {
    pub fn new_from_env() -> Self {
        // No environment variables needed for direct SDK approach
        Self::new()
    }

    pub fn new() -> Self {
        Self {}
    }

    // ============================================================================
    // NON-CUSTODIAL ARCHITECTURE: Read-Only Query Methods
    // Backend has NO operator key and CANNOT move funds
    // ============================================================================

    /// Placeholder for legacy withdrawal support (to be refactored)
    /// In non-custodial model, users withdraw directly via their wallet
    pub async fn send_on_behalf(&self, request: &WithdrawRequest) -> Result<String, KeetaError> {
        warn!(
            "[keeta] send_on_behalf called - this should be user-signed! user={} token={} amount={}",
            request.user_id, request.token, request.amount
        );
        // Return a placeholder transaction ID - in production, this should not be called
        // Users should withdraw directly via their wallet using Keeta SDK
        Ok(Uuid::new_v4().to_string())
    }

    /// Derive storage account address (for legacy compatibility)
    pub fn derive_storage_account(&self, user_id: &str, token: &str) -> DepositAddress {
        let storage_account = format!("vault:{}:{}", user_id, token);
        DepositAddress { storage_account }
    }

    /// Verify the on-chain balance of a token in a pool storage account
    /// Used for reconciliation to detect drift
    pub async fn verify_pool_reserves(
        &self,
        storage_account: &str,
        token: &str,
    ) -> Result<u64, String> {
        info!(
            "[keeta] verify_pool_reserves storage_account={} token={}",
            storage_account, token
        );

        // TODO: In production, use Keeta SDK to:
        // 1. Query storage account balance for specific token
        // 2. Return actual on-chain balance
        // 3. Use fully consistent reads for accuracy
        // Note: This would require integrating Keeta SDK directly in Rust

        // For demo: return 0 (no on-chain balance yet)
        // In production, this would query the actual balance using Keeta SDK
        Ok(0)
    }

    /// Verify ACL permissions for a user on a storage account
    /// Used to check if user can deposit to pool
    pub async fn verify_acl(
        &self,
        user_id: &str,
        storage_account: &str,
        permission: &str,
    ) -> Result<bool, String> {
        info!(
            "[keeta] verify_acl user={} storage_account={} permission={}",
            user_id, storage_account, permission
        );

        // TODO: In production, use Keeta SDK to:
        // 1. Query ACL entries for storage_account
        // 2. Check if user_id has specified permission
        // 3. Consider permission hierarchy (most specific wins)
        // 4. Return true if permission granted
        // Note: This would require integrating Keeta SDK directly in Rust

        // For demo: return true (permissive)
        Ok(true)
    }

    /// Query user's token balance from Keeta network
    /// This should query the actual on-chain balance, not internal ledger
    /// Reserved for future production use when Keeta SDK integration is implemented
    #[allow(dead_code)]
    pub async fn query_balance(&self, wallet_address: &str, token: &str) -> Result<u64, String> {
        info!(
            "[keeta] query_balance wallet={} token={}",
            wallet_address, token
        );

        // TODO: In production, use Keeta SDK:
        // - Direct SDK calls to query account balances
        // - Return actual on-chain balance
        // Note: This would require integrating Keeta SDK directly in Rust

        // For now: This should be queried from Keeta network
        // Frontend wallet already shows real balances from Keeta
        // Backend should trust those and verify on-chain before settlement
        warn!(
            "[keeta] query_balance is placeholder - real integration needed. Wallet: {}, Token: {}",
            wallet_address, token
        );

        Ok(0) // Placeholder - will be replaced with real SDK call
    }
}

pub async fn healthcheck(_client: &KeetaClient) -> bool {
    // For direct SDK approach, we don't need to check RPC connectivity
    // The frontend wallet handles all SDK interactions
    // Backend is just a coordinator with no direct Keeta network dependency
    info!("[keeta] healthcheck passed - using direct SDK approach");
    true
}
