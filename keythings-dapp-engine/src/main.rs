mod api;
mod engine;
mod keeta;
mod ledger;
mod models;
mod reconcile;
mod settlement;
mod websocket;
mod pool;
mod pool_api;

use crate::api::AppState;
use crate::engine::start_engine;
use crate::ledger::Ledger;
use crate::pool::PoolManager;
use crate::pool_api::PoolState;
use actix_web::{middleware::Logger, web, App, HttpServer};
use actix_cors::Cors;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();

    let ledger = Ledger::new();
    
    // Real Keeta Integration: NO MORE DEMO SEEDING
    // Balances should come from user's actual Keeta wallet
    // Frontend queries balances from Keeta network via wallet provider
    // Backend will verify balances on-chain before settlement
    log::info!("Ledger initialized - balances from real Keeta wallets only");
    
    let engine = start_engine(ledger.clone());
    let keeta_client = keeta::KeetaClient::new_from_env();
    if !keeta::healthcheck(&keeta_client).await {
        log::warn!("keeta rpc healthcheck failed");
    }
    let settlement_queue = settlement::SettlementQueue::new(keeta_client.clone(), ledger.clone());
    
    // Initialize pool manager
    let pool_manager = PoolManager::new();
    
    // Phase 5: Initialize reconciler with pool support
    let reconciler = reconcile::Reconciler::with_pool_support(
        ledger.clone(),
        keeta_client.clone(),
        pool_manager.clone(),
    );

    let state = AppState::new(
        ledger.clone(),
        engine,
        settlement_queue.clone(),
        reconciler,
        keeta_client.clone()
    );
    
    // Phase 2: Initialize PoolState with keeta_client and settlement_queue
    let pool_state = PoolState {
        pool_manager: pool_manager.clone(),
        ledger: ledger.clone(),
        keeta_client: keeta_client.clone(),
        settlement_queue: settlement_queue.clone(),
    };

    // Phase 5: Start periodic pool reconciliation worker
    let reconciler_for_pool = state.reconciler.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
        // Skip immediate first tick
        interval.tick().await;
        
        loop {
            interval.tick().await;
            log::info!("[reconcile] Starting periodic pool reconciliation");
            reconciler_for_pool.reconcile_all_pools().await;
        }
    });

    HttpServer::new(move || {
        // Configure CORS to allow frontend access
        let cors = Cors::default()
            .allowed_origin("http://localhost:3000")
            .allowed_origin("http://127.0.0.1:3000")
            .allowed_methods(vec!["GET", "POST", "DELETE", "OPTIONS"])
            .allowed_headers(vec![
                actix_web::http::header::AUTHORIZATION,
                actix_web::http::header::ACCEPT,
                actix_web::http::header::CONTENT_TYPE,
            ])
            .max_age(3600);

        App::new()
            .wrap(cors)
            .wrap(Logger::default())
            .app_data(web::Data::new(state.clone()))
            .app_data(web::Data::new(pool_state.clone()))
            .route("/ws/trade", web::get().to(websocket::ws_trade))
            .configure(api::configure)
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}
