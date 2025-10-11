use actix_web::{web, HttpResponse, Responder};
use log::info;
use serde::Deserialize;

use crate::engine::{Engine, EngineError};
use crate::keeta::KeetaClient;
use crate::ledger::Ledger;
use crate::models::{
    AuthChallenge, AuthSession, Balance, CancelOrderRequest, DepositAddress, LimitOrder,
    PlaceOrderResponse, PlacedOrder, WithdrawEnqueued, WithdrawRequest,
};
use crate::reconcile::Reconciler;
use crate::settlement::SettlementQueue;

#[derive(Clone)]
pub struct AppState {
    pub ledger: Ledger,
    pub engine: Engine,
    pub settlement: SettlementQueue,
    pub reconciler: Reconciler,
    pub keeta: KeetaClient,
}

impl AppState {
    pub fn new(
        ledger: Ledger,
        engine: Engine,
        settlement: SettlementQueue,
        reconciler: Reconciler,
        keeta: KeetaClient,
    ) -> Self {
        Self {
            ledger,
            engine,
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
struct PlaceOrderPayload {
    user_id: String,
    #[serde(flatten)]
    order: LimitOrder,
}

#[derive(Deserialize)]
struct CreditBalancePayload {
    user_id: String,
    token: String,
    amount: f64,
}

#[derive(Deserialize)]
struct CancelOrderQuery {
    user_id: String,
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .route("/health", web::get().to(health))
            .route("/auth/challenge/{pubkey}", web::get().to(auth_challenge))
            .route("/auth/session", web::post().to(create_session))
            .route("/balances/{user_id}", web::get().to(list_balances))
            .route("/internal/credit", web::post().to(credit_balance))
            .route("/orders", web::post().to(place_order))
            .route("/orders/{order_id}", web::delete().to(cancel_order))
            .route("/withdrawals", web::post().to(withdraw))
            .route("/deposit/{user_id}/{token}", web::get().to(deposit_address)),
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

async fn place_order(
    state: web::Data<AppState>,
    payload: web::Json<PlaceOrderPayload>,
) -> impl Responder {
    let result: Result<PlacedOrder, EngineError> = state
        .engine
        .place_order(payload.user_id.clone(), payload.order.clone())
        .await;

    match result {
        Ok(order) => HttpResponse::Ok().json(PlaceOrderResponse { order }),
        Err(err) => map_engine_error(err),
    }
}

async fn cancel_order(
    state: web::Data<AppState>,
    path: web::Path<String>,
    query: web::Query<CancelOrderQuery>,
    payload: web::Json<CancelOrderRequest>,
) -> impl Responder {
    let order_id = path.into_inner();
    if order_id != payload.id {
        return HttpResponse::BadRequest().json(serde_json::json!({ "error": "id mismatch" }));
    }

    match state
        .engine
        .cancel_order(query.user_id.clone(), payload.id.clone())
        .await
    {
        Ok(_) => HttpResponse::Ok().finish(),
        Err(err) => map_engine_error(err),
    }
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

fn map_engine_error(err: EngineError) -> HttpResponse {
    match err {
        EngineError::InvalidMarket => HttpResponse::BadRequest().json(error_body("invalid market")),
        EngineError::InsufficientBalance => {
            HttpResponse::BadRequest().json(error_body("insufficient balance"))
        }
        EngineError::OrderNotFound => HttpResponse::NotFound().json(error_body("order not found")),
        EngineError::Internal => HttpResponse::InternalServerError().finish(),
    }
}

fn error_body(message: &str) -> serde_json::Value {
    serde_json::json!({ "error": message })
}
