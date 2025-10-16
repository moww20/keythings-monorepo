use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::keeta_rfq::KeetaRFQManager;

// RFQ Order Types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RFQOrder {
    pub id: String,
    pub pair: String,
    pub side: String, // "buy" or "sell"
    pub price: f64,
    pub size: f64,
    pub min_fill: Option<f64>,
    pub expiry: String,
    pub maker: RFQMakerMeta,
    pub unsigned_block: String,
    pub maker_signature: String,
    pub allowlisted: bool,
    pub status: String, // "open", "pending_fill", "filled", "expired"
    pub taker_fill_amount: Option<f64>,
    pub taker_address: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RFQMakerMeta {
    pub id: String,
    pub display_name: String,
    pub verified: bool,
    pub reputation_score: f64,
    pub auto_sign_sla_ms: u64,
    pub fills_completed: u64,
    pub failure_rate: f64,
    pub allowlist_label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RFQFillRequest {
    pub taker_address: Option<String>,
    pub taker_amount: f64,
    pub auto_publish: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RFQFillResponse {
    pub order: RFQOrder,
    pub status: String, // "initiated", "settled", "rejected"
    pub latency_ms: u64,
}

// In-memory storage for RFQ orders and makers
type RFQStorage = Arc<Mutex<HashMap<String, RFQOrder>>>;
type MakerStorage = Arc<Mutex<HashMap<String, RFQMakerMeta>>>;

// Global storage instances
lazy_static::lazy_static! {
    static ref RFQ_ORDERS: RFQStorage = Arc::new(Mutex::new(HashMap::new()));
    static ref MAKERS: MakerStorage = Arc::new(Mutex::new(HashMap::new()));
    static ref KEETA_RFQ_MANAGER: Arc<Mutex<KeetaRFQManager>> = Arc::new(Mutex::new(KeetaRFQManager::new()));
}

// Initialize with some sample data
pub fn init_rfq_data() {
    // Initialize some sample makers
    let mut makers = MAKERS.lock().unwrap();
    makers.insert("maker-1".to_string(), RFQMakerMeta {
        id: "maker-1".to_string(),
        display_name: "Sample Maker 1".to_string(),
        verified: true,
        reputation_score: 95.0,
        auto_sign_sla_ms: 1000,
        fills_completed: 150,
        failure_rate: 0.02,
        allowlist_label: Some("verified".to_string()),
    });
    makers.insert("maker-2".to_string(), RFQMakerMeta {
        id: "maker-2".to_string(),
        display_name: "Sample Maker 2".to_string(),
        verified: false,
        reputation_score: 78.0,
        auto_sign_sla_ms: 2000,
        fills_completed: 45,
        failure_rate: 0.05,
        allowlist_label: None,
    });

    // Initialize some sample orders
    let mut orders = RFQ_ORDERS.lock().unwrap();
    
    // Sample buy order for BTC/USD
    orders.insert("order-1".to_string(), RFQOrder {
        id: "order-1".to_string(),
        pair: "BTC/USD".to_string(),
        side: "buy".to_string(),
        price: 65000.0,
        size: 0.1,
        min_fill: Some(0.05),
        expiry: "2024-12-31T23:59:59Z".to_string(),
        maker: makers.get("maker-1").unwrap().clone(),
        unsigned_block: "sample_unsigned_block_1".to_string(),
        maker_signature: "sample_maker_signature_1".to_string(),
        allowlisted: true,
        status: "open".to_string(),
        taker_fill_amount: None,
        taker_address: None,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
    });

    // Sample sell order for BTC/USD
    orders.insert("order-2".to_string(), RFQOrder {
        id: "order-2".to_string(),
        pair: "BTC/USD".to_string(),
        side: "sell".to_string(),
        price: 65100.0,
        size: 0.05,
        min_fill: Some(0.01),
        expiry: "2024-12-31T23:59:59Z".to_string(),
        maker: makers.get("maker-2").unwrap().clone(),
        unsigned_block: "sample_unsigned_block_2".to_string(),
        maker_signature: "sample_maker_signature_2".to_string(),
        allowlisted: false,
        status: "open".to_string(),
        taker_fill_amount: None,
        taker_address: None,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
    });

    // Sample order for ETH/USD
    orders.insert("order-3".to_string(), RFQOrder {
        id: "order-3".to_string(),
        pair: "ETH/USD".to_string(),
        side: "buy".to_string(),
        price: 3500.0,
        size: 1.0,
        min_fill: Some(0.5),
        expiry: "2024-12-31T23:59:59Z".to_string(),
        maker: makers.get("maker-1").unwrap().clone(),
        unsigned_block: "sample_unsigned_block_3".to_string(),
        maker_signature: "sample_maker_signature_3".to_string(),
        allowlisted: true,
        status: "open".to_string(),
        taker_fill_amount: None,
        taker_address: None,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
    });
}


// Get all makers
pub async fn get_makers() -> impl Responder {
    let makers = MAKERS.lock().unwrap();
    let maker_list: Vec<RFQMakerMeta> = makers.values().cloned().collect();
    HttpResponse::Ok().json(maker_list)
}

// Get orders with optional pair filter
pub async fn get_orders(query: web::Query<HashMap<String, String>>) -> impl Responder {
    let orders = RFQ_ORDERS.lock().unwrap();
    let mut order_list: Vec<RFQOrder> = orders.values().cloned().collect();

    // Filter by pair if specified
    if let Some(pair) = query.get("pair") {
        order_list.retain(|order| order.pair == *pair);
    }

    HttpResponse::Ok().json(order_list)
}

// Get specific order by ID
pub async fn get_order(path: web::Path<String>) -> impl Responder {
    let order_id = path.into_inner();
    let orders = RFQ_ORDERS.lock().unwrap();
    
    match orders.get(&order_id) {
        Some(order) => HttpResponse::Ok().json(order.clone()),
        None => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Order not found"
        })),
    }
}

// Fill an order
pub async fn fill_order(
    path: web::Path<String>,
    payload: web::Json<RFQFillRequest>,
) -> impl Responder {
    let order_id = path.into_inner();
    
    // Fill the order on Keeta testnet
    let mut keeta_manager = KEETA_RFQ_MANAGER.lock().unwrap();
    match keeta_manager.fill_rfq_order(&order_id, payload.taker_amount, payload.taker_address.clone()).await {
        Ok(_keeta_order) => {
            log::info!("[RFQ] Order {} filled on Keeta testnet", order_id);
            
            // Update local memory
            let mut orders = RFQ_ORDERS.lock().unwrap();
            if let Some(order) = orders.get_mut(&order_id) {
                order.status = "filled".to_string();
                order.taker_fill_amount = Some(payload.taker_amount);
                order.taker_address = payload.taker_address.clone();
                order.updated_at = chrono::Utc::now().to_rfc3339();
                
                // Create response
                let response = RFQFillResponse {
                    order: order.clone(),
                    status: "settled".to_string(),
                    latency_ms: 100, // Simulate latency
                };
                
                HttpResponse::Ok().json(response)
            } else {
                HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Order not found in local storage"
                }))
            }
        }
        Err(e) => {
            log::error!("[RFQ] Failed to fill order {} on Keeta testnet: {}", order_id, e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to fill order on Keeta testnet: {}", e)
            }))
        }
    }
}

// Create a new RFQ order
pub async fn create_order(payload: web::Json<RFQOrder>) -> impl Responder {
    let order = payload.into_inner();
    
    // Generate a unique ID if not provided
    let order_id = if order.id.is_empty() {
        format!("order-{}", chrono::Utc::now().timestamp_millis())
    } else {
        order.id.clone()
    };
    
    let mut new_order = order;
    new_order.id = order_id.clone();
    new_order.created_at = chrono::Utc::now().to_rfc3339();
    new_order.updated_at = chrono::Utc::now().to_rfc3339();
    
    // Create the order on Keeta testnet
    let mut keeta_manager = KEETA_RFQ_MANAGER.lock().unwrap();
    match keeta_manager.create_rfq_order(new_order.clone()).await {
        Ok(keeta_order) => {
            log::info!("[RFQ] Order {} created on Keeta testnet with token ID: {}", 
                      order_id, keeta_order.keeta_token_id);
            
            // Also store in local memory for quick access
            let mut orders = RFQ_ORDERS.lock().unwrap();
            orders.insert(order_id.clone(), new_order.clone());
            
            HttpResponse::Created().json(new_order)
        }
        Err(e) => {
            log::error!("[RFQ] Failed to create order {} on Keeta testnet: {}", order_id, e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to create order on Keeta testnet: {}", e)
            }))
        }
    }
}

// Cancel an order
pub async fn cancel_order(path: web::Path<String>) -> impl Responder {
    let order_id = path.into_inner();
    
    // Cancel the order on Keeta testnet
    let mut keeta_manager = KEETA_RFQ_MANAGER.lock().unwrap();
    match keeta_manager.cancel_rfq_order(&order_id).await {
        Ok(_) => {
            log::info!("[RFQ] Order {} cancelled on Keeta testnet", order_id);
            
            // Also remove from local memory
            let mut orders = RFQ_ORDERS.lock().unwrap();
            orders.remove(&order_id);
            
            HttpResponse::NoContent().finish()
        }
        Err(e) => {
            log::error!("[RFQ] Failed to cancel order {} on Keeta testnet: {}", order_id, e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to cancel order on Keeta testnet: {}", e)
            }))
        }
    }
}
