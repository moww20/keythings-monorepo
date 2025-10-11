use std::env;

use log::{info, warn};

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

    pub async fn send_on_behalf(&self, request: &WithdrawRequest) -> Result<(), KeetaError> {
        info!(
            "[settlement] send_on_behalf user={} token={} amount={} to={} via {}",
            request.user_id, request.token, request.amount, request.to, self.rpc_url
        );
        if self.rpc_url.starts_with("http") {
            Ok(())
        } else {
            Err(KeetaError::Rpc("invalid rpc url".into()))
        }
    }

    pub fn derive_storage_account(&self, user_id: &str, token: &str) -> DepositAddress {
        // Deterministic placeholder storage account for demos.
        let storage_account = format!("vault:{}:{}", user_id, token);
        DepositAddress { storage_account }
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
