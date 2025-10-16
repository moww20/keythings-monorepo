use actix_web::{web, HttpResponse, Responder};
use log::info;
use serde::Deserialize;

use crate::keeta::KeetaClient;
use crate::ledger::Ledger;
use crate::models::{
    AuthChallenge, AuthSession, Balance, DepositAddress, WithdrawEnqueued, WithdrawRequest,
};
use crate::reconcile::Reconciler;
use crate::settlement::SettlementQueue;
use serde::Serialize;

#[derive(Clone)]
pub struct AppState {
    pub ledger: Ledger,
    pub settlement: SettlementQueue,
    pub reconciler: Reconciler,
    pub keeta: KeetaClient,
}

impl AppState {
    pub fn new(
        ledger: Ledger,
        settlement: SettlementQueue,
        reconciler: Reconciler,
        keeta: KeetaClient,
    ) -> Self {
        Self {
            ledger,
            settlement,
            reconciler,
            keeta,
        }
    }
}

#[derive(Deserialize)]
struct AuthSessionRequest {
    user_id: String,
    signature: String,
}


#[derive(Deserialize)]
struct CreditBalancePayload {
    user_id: String,
    token: String,
    amount: f64,
}


#[derive(Deserialize)]
struct RegisterUserPayload {
    user_id: String,
    storage_account: String,
}

#[derive(Serialize)]
struct UserStatusResponse {
    user_id: String,
    trading_enabled: bool,
    storage_account: Option<String>,
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .route("/health", web::get().to(health))
            .route("/auth/challenge/{pubkey}", web::get().to(auth_challenge))
            .route("/auth/session", web::post().to(create_session))
            .route("/users/register", web::post().to(register_user))
            .route("/users/{user_id}/status", web::get().to(user_status))
            .route("/balances/{user_id}", web::get().to(list_balances))
            .route("/internal/credit", web::post().to(credit_balance))
            .route("/withdrawals", web::post().to(withdraw))
            .route("/deposit/{user_id}/{token}", web::get().to(deposit_address))
            // Pool routes
            .route("/pools/list", web::get().to(crate::pool_api::list_pools))
            .route("/pools/{pool_id}", web::get().to(crate::pool_api::get_pool))
            .route(
                "/pools/create",
                web::post().to(crate::pool_api::create_pool),
            )
            .route(
                "/pools/created",
                web::post().to(crate::pool_api::notify_pool_created),
            )
            .route(
                "/pools/add-liquidity",
                web::post().to(crate::pool_api::add_liquidity),
            )
            .route(
                "/pools/remove-liquidity",
                web::post().to(crate::pool_api::remove_liquidity),
            )
            .route(
                "/pools/swap/telemetry",
                web::post().to(crate::pool_api::record_swap_telemetry),
            )
            .route("/pools/quote", web::post().to(crate::pool_api::quote))
            .route(
                "/pools/{pool_id}/unpause",
                web::post().to(crate::pool_api::unpause_pool),
            )
            // RFQ routes
            .route("/rfq/makers", web::get().to(crate::rfq_api::get_makers))
            .route("/rfq/orders", web::get().to(crate::rfq_api::get_orders))
            .route("/rfq/orders", web::post().to(crate::rfq_api::create_order))
            .route("/rfq/orders/{order_id}", web::get().to(crate::rfq_api::get_order))
            .route("/rfq/orders/{order_id}/fill-request", web::post().to(crate::rfq_api::fill_order))
            .route("/rfq/orders/{order_id}", web::delete().to(crate::rfq_api::cancel_order)),
    );
}

async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({ "status": "ok" }))
}

async fn auth_challenge(_pubkey: web::Path<String>) -> impl Responder {
    let nonce = uuid::Uuid::new_v4().to_string();
    let challenge = AuthChallenge { nonce };
    HttpResponse::Ok().json(challenge)
}

async fn create_session(payload: web::Json<AuthSessionRequest>) -> impl Responder {
    // Placeholder session issuance. Signature validation occurs in later phases.
    info!(
        "creating session for {} (signature bytes: {})",
        payload.user_id,
        payload.signature.as_bytes().len()
    );
    let session = AuthSession {
        user_id: payload.user_id.clone(),
        jwt: format!("demo-token-for-{}", payload.user_id),
    };
    HttpResponse::Ok().json(session)
}

async fn register_user(
    _state: web::Data<AppState>,
    payload: web::Json<RegisterUserPayload>,
) -> impl Responder {
    // Register user with their storage account
    // In a real implementation, this would store in a database
    info!(
        "Registering user {} with storage account {}",
        payload.user_id, payload.storage_account
    );

    // TODO: Store in database
    // For now, we'll just log and return success

    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": "User registered successfully",
        "user_id": payload.user_id,
        "storage_account": payload.storage_account
    }))
}

async fn user_status(_state: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let user_id = path.into_inner();

    // TODO: Query database for user status
    // For now, return a mock response
    // In production, this would check if user has a registered storage account

    info!("Checking status for user {}", user_id);

    // For development: return false so users see the "Enable Trading" button
    let status = UserStatusResponse {
        user_id: user_id.clone(),
        trading_enabled: false,
        storage_account: None,
    };

    HttpResponse::Ok().json(status)
}

async fn list_balances(state: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let user_id = path.into_inner();
    let balances: Vec<Balance> = state.reconciler.snapshot_balances(&user_id);
    HttpResponse::Ok().json(balances)
}

async fn credit_balance(
    state: web::Data<AppState>,
    payload: web::Json<CreditBalancePayload>,
) -> impl Responder {
    state
        .ledger
        .credit(&payload.user_id, &payload.token, payload.amount);
    HttpResponse::Ok().finish()
}


async fn withdraw(
    state: web::Data<AppState>,
    payload: web::Json<WithdrawRequest>,
) -> impl Responder {
    let request = payload.into_inner();
    let amount: f64 = match request.amount.parse() {
        Ok(val) if val > 0.0 => val,
        _ => return HttpResponse::BadRequest().json(error_body("invalid amount")),
    };

    if !state
        .ledger
        .reserve(&request.user_id, &request.token, amount)
    {
        return HttpResponse::BadRequest().json(error_body("insufficient balance"));
    }
    state
        .ledger
        .debit_total(&request.user_id, &request.token, amount);

    let enqueued: WithdrawEnqueued = state.settlement.enqueue(request, amount);
    HttpResponse::Accepted().json(enqueued)
}

async fn deposit_address(
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> impl Responder {
    let (user_id, token) = path.into_inner();
    let deposit: DepositAddress = state.keeta.derive_storage_account(&user_id, &token);
    HttpResponse::Ok().json(deposit)
}


fn error_body(message: &str) -> serde_json::Value {
    serde_json::json!({ "error": message })
}
