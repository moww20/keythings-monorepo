mod api;
mod engine;
mod keeta;
mod ledger;
mod models;
mod reconcile;
mod settlement;
mod websocket;

use crate::api::AppState;
use crate::engine::start_engine;
use crate::ledger::Ledger;
use actix_web::{middleware::Logger, web, App, HttpServer};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();

    let ledger = Ledger::new();
    let engine = start_engine(ledger.clone());
    let keeta_client = keeta::KeetaClient::new_from_env();
    if !keeta::healthcheck(&keeta_client).await {
        log::warn!("keeta rpc healthcheck failed");
    }
    let settlement_queue = settlement::SettlementQueue::new(keeta_client.clone(), ledger.clone());
    let reconciler = reconcile::Reconciler::new(ledger.clone());

    let state = AppState::new(ledger, engine, settlement_queue, reconciler, keeta_client);

    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .app_data(web::Data::new(state.clone()))
            .route("/ws/trade", web::get().to(websocket::ws_trade))
            .configure(api::configure)
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}
