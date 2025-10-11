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

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Buy,
    Sell,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LimitOrder {
    pub market: String,
    pub side: Side,
    pub price: String,
    pub quantity: String,
    pub tif: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlacedOrder {
    pub id: String,
    #[serde(flatten)]
    pub order: LimitOrder,
    pub status: String,
    pub filled_quantity: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Balance {
    pub token: String,
    pub available: String,
    pub total: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WithdrawRequest {
    pub user_id: String,
    pub token: String,
    pub amount: String,
    pub to: PubKey58,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaceOrderResponse {
    pub order: PlacedOrder,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CancelOrderRequest {
    pub id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WithdrawEnqueued {
    pub request_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DepositAddress {
    pub storage_account: String,
}
