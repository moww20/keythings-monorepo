use serde::{Deserialize, Serialize};

pub type PubKey58 = String;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthChallenge {
    pub nonce: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthSession {
    pub user_id: String,
    pub jwt: String,
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Balance {
    pub token: String,
    pub available: String,
    pub total: String,
    pub on_chain: String,
    pub drift: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_reconciled_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WithdrawRequest {
    pub user_id: String,
    pub token: String,
    pub amount: String,
    pub to: PubKey58,
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WithdrawEnqueued {
    pub request_id: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DepositAddress {
    pub storage_account: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WithdrawalStatus {
    Pending,
    Completed,
    Failed,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WithdrawalRecord {
    pub id: String,
    pub user_id: String,
    pub token: String,
    pub amount: String,
    pub to: PubKey58,
    pub status: WithdrawalStatus,
    pub tx_id: Option<String>,
    pub last_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}
