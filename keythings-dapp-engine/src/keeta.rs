use std::env;

use log::{info, warn};
use uuid::Uuid;

use crate::models::{DepositAddress, WithdrawRequest};

#[derive(thiserror::Error, Debug)]
pub enum KeetaError {
    #[error("rpc call failed: {0}")]
    Rpc(String),
}

#[derive(Clone)]
pub struct KeetaClient {
    rpc_url: String,
}

impl KeetaClient {
    pub fn new_from_env() -> Self {
        let rpc_url =
            env::var("KEETA_RPC_URL").unwrap_or_else(|_| "https://rpc.testnet.keeta".to_string());
        Self::new(rpc_url)
    }

    pub fn new(rpc_url: impl Into<String>) -> Self {
        Self {
            rpc_url: rpc_url.into(),
        }
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
        if self.rpc_url.starts_with("http") {
            Ok(Uuid::new_v4().to_string())
        } else {
            Err(KeetaError::Rpc("invalid rpc url".into()))
        }
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

        // TODO: In production, call Keeta RPC to:
        // 1. Query storage account balance for specific token
        // 2. Return actual on-chain balance
        // 3. Use fully consistent reads for accuracy

        if !self.rpc_url.starts_with("http") {
            return Err("Invalid RPC URL".to_string());
        }

        // For demo: return 0 (no on-chain balance yet)
        // In production, this would query the actual balance
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

        // TODO: In production, call Keeta RPC to:
        // 1. Query ACL entries for storage_account
        // 2. Check if user_id has specified permission
        // 3. Consider permission hierarchy (most specific wins)
        // 4. Return true if permission granted

        if !self.rpc_url.starts_with("http") {
            return Err("Invalid RPC URL".to_string());
        }

        // For demo: return true (permissive)
        Ok(true)
    }

    /// Query user's token balance from Keeta network
    /// This should query the actual on-chain balance, not internal ledger
    /// Reserved for future production use when Keeta RPC balance query is implemented
    #[allow(dead_code)]
    pub async fn query_balance(&self, wallet_address: &str, token: &str) -> Result<u64, String> {
        info!(
            "[keeta] query_balance wallet={} token={}",
            wallet_address, token
        );

        // TODO: In production, call Keeta RPC:
        // - GET /api/v1/accounts/{wallet_address}/balances/{token}
        // - Or use Keeta SDK if we add Node.js bridge
        // - Return actual on-chain balance

        if !self.rpc_url.starts_with("http") {
            return Err("Invalid RPC URL".to_string());
        }

        // For now: This should be queried from Keeta network
        // Frontend wallet already shows real balances from Keeta
        // Backend should trust those and verify on-chain before settlement
        warn!(
            "[keeta] query_balance is placeholder - real integration needed. Wallet: {}, Token: {}",
            wallet_address, token
        );

        Ok(0) // Placeholder - will be replaced with real RPC call
    }
}

pub async fn healthcheck(client: &KeetaClient) -> bool {
    // Placeholder, would call the RPC node in production.
    if client.rpc_url.is_empty() {
        warn!("keeta rpc url missing");
        return false;
    }
    true
}
