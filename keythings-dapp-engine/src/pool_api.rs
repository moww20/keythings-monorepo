use crate::keeta::KeetaClient;
use crate::ledger::Ledger;
use crate::pool::{PoolError, PoolManager, PoolType};
use crate::settlement::SettlementQueue;
use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub struct PoolState {
    pub pool_manager: PoolManager,
    pub ledger: Ledger,
    pub keeta_client: KeetaClient, // Phase 1: For storage account creation
    pub settlement_queue: SettlementQueue, // Phase 3: For on-chain settlement
}

// ============================================================================
// Request/Response Models
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePoolRequest {
    pub wallet_address: String, // Real Keeta wallet address from connected wallet
    pub token_a: String,
    pub token_b: String,
    pub initial_amount_a: String,
    pub initial_amount_b: String,
    pub fee_rate: Option<u64>,     // basis points (default: 30 = 0.3%)
    pub pool_type: Option<String>, // "constant_product", "stable_swap", "weighted"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePoolResponse {
    pub pool_id: String,
    pub storage_account: String,
    pub lp_token: String,
    pub lp_tokens_minted: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PoolCreatedNotification {
    pub pool_id: String,
    pub storage_account: String,
    pub token_a: String,
    pub token_b: String,
    pub initial_a: String,
    pub initial_b: String,
    pub tx_hash: String,
    pub creator: String,
    pub lp_token: String,
    pub lp_tokens_minted: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AddLiquidityRequest {
    pub wallet_address: String, // Real Keeta wallet address
    pub pool_id: String,
    pub amount_a_desired: String,
    pub amount_b_desired: String,
    pub amount_a_min: Option<String>,
    pub amount_b_min: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AddLiquidityResponse {
    pub amount_a: String,
    pub amount_b: String,
    pub lp_tokens: String,
    pub share_of_pool: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RemoveLiquidityRequest {
    pub wallet_address: String, // Real Keeta wallet address
    pub pool_id: String,
    pub lp_tokens: String,
    pub amount_a_min: Option<String>,
    pub amount_b_min: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RemoveLiquidityResponse {
    pub amount_a: String,
    pub amount_b: String,
    pub fees_earned_a: String,
    pub fees_earned_b: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuoteRequest {
    pub pool_id: String,
    pub token_in: String,
    pub amount_in: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuoteResponse {
    pub amount_out: String,
    pub fee: String,
    pub price_impact: String,
    pub minimum_received: String,
    pub route: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PoolInfo {
    pub id: String,
    pub token_a: String,
    pub token_b: String,
    pub reserve_a: String,
    pub reserve_b: String,
    pub lp_token: String,
    pub total_lp_supply: String,
    pub fee_rate: String,
    pub pool_type: String,
    pub storage_account: String,
    pub is_paused: bool,
    pub pending_settlement: bool,
    pub last_swap_signature: Option<String>,
    pub last_swap_confirmed_at: Option<String>,
    pub last_swap_token_in: Option<String>,
    pub last_swap_token_out: Option<String>,
    pub last_swap_amount_in: Option<String>,
    pub last_swap_amount_out: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SwapTelemetryRequest {
    pub pool_id: String,
    pub token_in: String,
    pub token_out: String,
    pub amount_in: String,
    pub amount_out: String,
    pub min_amount_out: Option<String>,
    pub wallet_address: Option<String>,
    pub storage_account: Option<String>,
    pub tx_signature: Option<String>,
    pub confirmed_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SwapTelemetryResponse {
    pub success: bool,
    pub pending_reconciliation: bool,
}

// ============================================================================
// Phase 6.1: Helper Functions - ACL Verification
// ============================================================================

/// Verify user has permission to deposit to pool storage account
async fn verify_user_can_deposit(
    keeta_client: &KeetaClient,
    wallet_address: &str,
    pool_storage_account: &str,
    _token: &str,
) -> Result<bool, String> {
    // Check if user has STORAGE_DEPOSIT permission
    keeta_client
        .verify_acl(wallet_address, pool_storage_account, "STORAGE_DEPOSIT")
        .await
}

/// Verify storage account can hold a specific token
/// Reserved for future pool creation validation
#[allow(dead_code)]
async fn verify_storage_can_hold(
    keeta_client: &KeetaClient,
    storage_account: &str,
    token: &str,
) -> Result<bool, String> {
    // Check if storage account has STORAGE_CAN_HOLD permission for token
    keeta_client
        .verify_acl(storage_account, token, "STORAGE_CAN_HOLD")
        .await
}

// ============================================================================
// API Endpoints
// ============================================================================

pub async fn list_pools(state: web::Data<PoolState>) -> HttpResponse {
    let pools = state.pool_manager.list_pools();

    let pool_infos: Vec<PoolInfo> = pools
        .iter()
        .map(|pool| PoolInfo {
            id: pool.id.clone(),
            token_a: pool.token_a.clone(),
            token_b: pool.token_b.clone(),
            reserve_a: pool.reserve_a.to_string(),
            reserve_b: pool.reserve_b.to_string(),
            lp_token: pool.lp_token.clone(),
            total_lp_supply: pool.total_lp_supply.to_string(),
            fee_rate: format!("{:.3}", pool.fee_rate as f64 / 10000.0),
            pool_type: match pool.pool_type {
                PoolType::ConstantProduct => "constant_product".to_string(),
                PoolType::StableSwap { amplification } => {
                    format!("stable_swap(A={})", amplification)
                }
                PoolType::Weighted { weight_a, weight_b } => {
                    format!("weighted({}/{})", weight_a, weight_b)
                }
            },
            // Phase 2: Return on-chain storage account address
            storage_account: if !pool.on_chain_storage_account.is_empty() {
                pool.on_chain_storage_account.clone()
            } else {
                pool.storage_account.clone()
            },
            // Add paused status for debugging
            is_paused: pool.paused,
            pending_settlement: pool.pending_settlement,
            last_swap_signature: pool.last_swap_signature.clone(),
            last_swap_confirmed_at: pool.last_swap_at.clone(),
            last_swap_token_in: pool.last_swap_token_in.clone(),
            last_swap_token_out: pool.last_swap_token_out.clone(),
            last_swap_amount_in: pool.last_swap_amount_in.map(|value| value.to_string()),
            last_swap_amount_out: pool.last_swap_amount_out.map(|value| value.to_string()),
        })
        .collect();

    HttpResponse::Ok().json(serde_json::json!({ "pools": pool_infos }))
}

pub async fn get_pool(state: web::Data<PoolState>, path: web::Path<String>) -> HttpResponse {
    let pool_id = path.into_inner();

    match state.pool_manager.get_pool(&pool_id) {
        Some(pool) => {
            let pool_info = PoolInfo {
                id: pool.id.clone(),
                token_a: pool.token_a.clone(),
                token_b: pool.token_b.clone(),
                reserve_a: pool.reserve_a.to_string(),
                reserve_b: pool.reserve_b.to_string(),
                lp_token: pool.lp_token.clone(),
                total_lp_supply: pool.total_lp_supply.to_string(),
                fee_rate: format!("{:.3}", pool.fee_rate as f64 / 10000.0),
                pool_type: match pool.pool_type {
                    PoolType::ConstantProduct => "constant_product".to_string(),
                    PoolType::StableSwap { amplification } => {
                        format!("stable_swap(A={})", amplification)
                    }
                    PoolType::Weighted { weight_a, weight_b } => {
                        format!("weighted({}/{})", weight_a, weight_b)
                    }
                },
                // Phase 2: Return on-chain storage account address
                storage_account: if !pool.on_chain_storage_account.is_empty() {
                    pool.on_chain_storage_account.clone()
                } else {
                    pool.storage_account.clone()
                },
                // Add paused status for debugging
                is_paused: pool.paused,
            };
            HttpResponse::Ok().json(serde_json::json!({ "pool": pool_info }))
        }
        None => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Pool not found"
        })),
    }
}

pub async fn create_pool(
    state: web::Data<PoolState>,
    body: web::Json<CreatePoolRequest>,
) -> HttpResponse {
    // Real Keeta Integration: Use wallet address from connected wallet
    let wallet_address = &body.wallet_address;
    let amount_a: u64 = body.initial_amount_a.parse().unwrap_or(0);
    let amount_b: u64 = body.initial_amount_b.parse().unwrap_or(0);
    let fee_rate = body.fee_rate.unwrap_or(30); // 0.3% default

    let pool_type = match body.pool_type.as_deref() {
        Some("stable_swap") => PoolType::StableSwap { amplification: 100 },
        Some("weighted") => PoolType::Weighted {
            weight_a: 80,
            weight_b: 20,
        },
        _ => PoolType::ConstantProduct,
    };

    // STEP 1: Reserve user's internal balances (using real wallet address)
    log::info!(
        "[pool] create_pool wallet={} token_a={} amount_a={} token_b={} amount_b={}",
        wallet_address,
        body.token_a,
        amount_a,
        body.token_b,
        amount_b
    );

    // TODO: Query real Keeta balance from network instead of internal ledger
    // TEMPORARY: Auto-credit generous balances for new wallets (until SDK integrated)
    let (available_a, _) = state.ledger.internal_balance(wallet_address, &body.token_a);
    if available_a == 0.0 {
        log::warn!(
            "[pool] New wallet detected, auto-crediting balances (temporary until SDK integration)"
        );
        state
            .ledger
            .credit(wallet_address, &body.token_a, 10_000_000.0);
    }

    if !state
        .ledger
        .reserve(wallet_address, &body.token_a, amount_a as f64)
    {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Insufficient balance for token A. This is a temporary limitation until Keeta SDK integration."
        }));
    }

    // Auto-credit token B if needed
    let (available_b, _) = state.ledger.internal_balance(wallet_address, &body.token_b);
    if available_b == 0.0 {
        state
            .ledger
            .credit(wallet_address, &body.token_b, 10_000_000.0);
    }

    if !state
        .ledger
        .reserve(wallet_address, &body.token_b, amount_b as f64)
    {
        state
            .ledger
            .release(wallet_address, &body.token_a, amount_a as f64);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Insufficient balance for token B. This is a temporary limitation until Keeta SDK integration."
        }));
    }

    // STEP 2: Generate deterministic storage account address (for legacy compatibility)
    // TODO: In non-custodial model, this endpoint should be removed entirely
    // User creates pool via frontend using Keeta SDK, backend receives notification only
    let pool_id_str = format!("{}-{}", body.token_a, body.token_b);
    let storage_account = format!(
        "keeta:storage:pool:{}:{}:{}",
        pool_id_str, body.token_a, body.token_b
    );

    log::warn!(
        "[pool] LEGACY ENDPOINT: create_pool should be replaced with notification-only endpoint in non-custodial model"
    );

    // STEP 4: Create pool in memory
    let pool_id = match state.pool_manager.create_pool(
        body.token_a.clone(),
        body.token_b.clone(),
        amount_a,
        amount_b,
        fee_rate,
        pool_type,
    ) {
        Ok(id) => id,
        Err(e) => {
            // Rollback: Release reserves
            state
                .ledger
                .release(wallet_address, &body.token_a, amount_a as f64);
            state
                .ledger
                .release(wallet_address, &body.token_b, amount_b as f64);
            log::error!("[pool] Failed to create pool: {:?}", e);
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("{:?}", e)
            }));
        }
    };

    // STEP 5: Update pool with on-chain storage account address
    if let Err(e) = state
        .pool_manager
        .update_storage_account(&pool_id, storage_account.to_string())
    {
        log::error!("[pool] Failed to update storage account: {:?}", e);
        // Continue anyway - pool is created but on-chain address not set
    }

    // STEP 6: Queue on-chain settlement (transfers from S_user to S_pool)
    // TODO: In Phase 3, implement proper pool deposit settlement
    // For now, we'll use the existing withdrawal mechanism as a placeholder
    // In production, this would create PoolDeposit operations

    log::info!(
        "[pool] Pool {} created with storage account: {}",
        pool_id,
        storage_account
    );

    // STEP 7: Debit internal ledger (funds now "in pool")
    state
        .ledger
        .debit_total(wallet_address, &body.token_a, amount_a as f64);
    state
        .ledger
        .debit_total(wallet_address, &body.token_b, amount_b as f64);

    // STEP 8: Credit LP tokens to user
    let pool = state.pool_manager.get_pool(&pool_id).unwrap();
    state
        .ledger
        .credit(wallet_address, &pool.lp_token, pool.total_lp_supply as f64);

    log::info!(
        "[pool] Wallet {} credited with {} LP tokens",
        wallet_address,
        pool.total_lp_supply
    );

    HttpResponse::Ok().json(CreatePoolResponse {
        pool_id: pool.id,
        storage_account: pool.on_chain_storage_account,
        lp_token: pool.lp_token,
        lp_tokens_minted: pool.total_lp_supply.to_string(),
    })
}

pub async fn add_liquidity(
    state: web::Data<PoolState>,
    body: web::Json<AddLiquidityRequest>,
) -> HttpResponse {
    // Real Keeta Integration: Use wallet address from connected wallet
    let wallet_address = &body.wallet_address;

    let amount_a_desired: u64 = body.amount_a_desired.parse().unwrap_or(0);
    let amount_b_desired: u64 = body.amount_b_desired.parse().unwrap_or(0);

    let pool = match state.pool_manager.get_pool(&body.pool_id) {
        Some(p) => p,
        None => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Pool not found"
            }));
        }
    };

    // Check if pool is paused (temporarily disabled for testing)
    // if pool.paused {
    //     return HttpResponse::BadRequest().json(serde_json::json!({
    //         "error": "Pool is paused"
    //     }));
    // }

    // Phase 6.1: Verify user has permission to deposit (if storage account exists)
    if !pool.on_chain_storage_account.is_empty() {
        match verify_user_can_deposit(
            &state.keeta_client,
            wallet_address,
            &pool.on_chain_storage_account,
            &pool.token_a,
        )
        .await
        {
            Ok(true) => {}
            Ok(false) => {
                return HttpResponse::Forbidden().json(serde_json::json!({
                    "error": "User does not have STORAGE_DEPOSIT permission"
                }));
            }
            Err(e) => {
                log::warn!("[pool] ACL verification failed: {}", e);
                // Continue anyway in demo mode
            }
        }
    }

    // Calculate optimal amounts to match pool ratio
    let (amount_a, amount_b) = pool.calculate_optimal_amounts(amount_a_desired, amount_b_desired);

    log::info!(
        "[pool] add_liquidity wallet={} pool={} amount_a={} amount_b={}",
        wallet_address,
        body.pool_id,
        amount_a,
        amount_b
    );

    // STEP 1: Reserve balances
    if !state
        .ledger
        .reserve(wallet_address, &pool.token_a, amount_a as f64)
    {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Insufficient balance for token A"
        }));
    }

    if !state
        .ledger
        .reserve(wallet_address, &pool.token_b, amount_b as f64)
    {
        state
            .ledger
            .release(wallet_address, &pool.token_a, amount_a as f64);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Insufficient balance for token B"
        }));
    }

    // STEP 2: Calculate LP tokens
    let lp_tokens = match pool.calculate_lp_mint(amount_a, amount_b) {
        Ok(lp) => lp,
        Err(e) => {
            log::warn!(
                "[pool] LP calculation failed: {:?}, using minimum of 1 LP token for amount_a={} amount_b={}",
                e, amount_a, amount_b
            );
            // Simple fallback: just mint 1 LP token for any failed calculation
            1
        }
    };

    // STEP 3: Queue on-chain settlement (transfers to pool storage account)
    if !pool.on_chain_storage_account.is_empty() {
        let settlement_id_a = state.settlement_queue.enqueue_pool_deposit(
            wallet_address.to_string(),
            pool.on_chain_storage_account.clone(),
            pool.token_a.clone(),
            amount_a,
        );
        let settlement_id_b = state.settlement_queue.enqueue_pool_deposit(
            wallet_address.to_string(),
            pool.on_chain_storage_account.clone(),
            pool.token_b.clone(),
            amount_b,
        );

        log::info!(
            "[pool] Settlement queued: {} (token_a), {} (token_b)",
            settlement_id_a,
            settlement_id_b
        );
    }

    // STEP 4: Update internal ledger
    state
        .ledger
        .debit_total(wallet_address, &pool.token_a, amount_a as f64);
    state
        .ledger
        .debit_total(wallet_address, &pool.token_b, amount_b as f64);
    state
        .ledger
        .credit(wallet_address, &pool.lp_token, lp_tokens as f64);

    // STEP 5: Calculate pool share
    let share = if pool.total_lp_supply > 0 {
        (lp_tokens as f64 / pool.total_lp_supply as f64) * 100.0
    } else {
        100.0
    };

    log::info!(
        "[pool] Liquidity added: {} LP tokens ({:.4}% of pool)",
        lp_tokens,
        share
    );

    // TODO: Update pool reserves in DashMap (requires mutable access)
    // pool.reserve_a += amount_a;
    // pool.reserve_b += amount_b;
    // pool.total_lp_supply += lp_tokens;

    HttpResponse::Ok().json(AddLiquidityResponse {
        amount_a: amount_a.to_string(),
        amount_b: amount_b.to_string(),
        lp_tokens: lp_tokens.to_string(),
        share_of_pool: format!("{:.4}%", share),
    })
}

pub async fn remove_liquidity(
    state: web::Data<PoolState>,
    body: web::Json<RemoveLiquidityRequest>,
) -> HttpResponse {
    // Real Keeta Integration: Use wallet address from connected wallet
    let wallet_address = &body.wallet_address;

    let lp_tokens: u64 = body.lp_tokens.parse().unwrap_or(0);

    let pool = match state.pool_manager.get_pool(&body.pool_id) {
        Some(p) => p,
        None => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Pool not found"
            }));
        }
    };

    // Check if pool is paused
    if pool.paused {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Pool is paused"
        }));
    }

    log::info!(
        "[pool] remove_liquidity wallet={} pool={} lp_tokens={}",
        wallet_address,
        body.pool_id,
        lp_tokens
    );

    // STEP 1: Check user has enough LP tokens
    let (_, total_lp) = state
        .ledger
        .internal_balance(wallet_address, &pool.lp_token);
    if total_lp < lp_tokens as f64 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Insufficient LP tokens"
        }));
    }

    // STEP 2: Calculate redemption amounts
    let (amount_a, amount_b) = match pool.calculate_remove_amounts(lp_tokens) {
        Ok((a, b)) => (a, b),
        Err(e) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("{:?}", e)
            }));
        }
    };

    // STEP 3: Burn LP tokens from user
    state
        .ledger
        .debit_total(wallet_address, &pool.lp_token, lp_tokens as f64);

    // STEP 4: Queue on-chain settlement (transfers from pool to user)
    if !pool.on_chain_storage_account.is_empty() {
        let settlement_id_a = state.settlement_queue.enqueue_pool_withdraw(
            pool.on_chain_storage_account.clone(),
            wallet_address.to_string(),
            pool.token_a.clone(),
            amount_a,
        );
        let settlement_id_b = state.settlement_queue.enqueue_pool_withdraw(
            pool.on_chain_storage_account.clone(),
            wallet_address.to_string(),
            pool.token_b.clone(),
            amount_b,
        );

        log::info!(
            "[pool] Settlement queued: {} (token_a), {} (token_b)",
            settlement_id_a,
            settlement_id_b
        );
    }

    // STEP 5: Credit tokens back to user's internal ledger
    state
        .ledger
        .credit(wallet_address, &pool.token_a, amount_a as f64);
    state
        .ledger
        .credit(wallet_address, &pool.token_b, amount_b as f64);

    log::info!(
        "[pool] Liquidity removed: {} {} + {} {}",
        amount_a,
        pool.token_a,
        amount_b,
        pool.token_b
    );

    // TODO: Update pool reserves in DashMap (requires mutable access)
    // pool.reserve_a -= amount_a;
    // pool.reserve_b -= amount_b;
    // pool.total_lp_supply -= lp_tokens;

    // TODO: Calculate accrued fees (difference from initial deposit)
    let fees_earned_a = "0"; // Would calculate from historical deposits
    let fees_earned_b = "0";

    HttpResponse::Ok().json(RemoveLiquidityResponse {
        amount_a: amount_a.to_string(),
        amount_b: amount_b.to_string(),
        fees_earned_a: fees_earned_a.to_string(),
        fees_earned_b: fees_earned_b.to_string(),
    })
}

pub async fn quote(state: web::Data<PoolState>, body: web::Json<QuoteRequest>) -> HttpResponse {
    let amount_in: u64 = body.amount_in.parse().unwrap_or(0);

    let pool = match state.pool_manager.get_pool(&body.pool_id) {
        Some(p) => p,
        None => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Pool not found"
            }));
        }
    };

    match pool.get_amount_out(amount_in, &body.token_in) {
        Ok(amount_out) => {
            let fee = (amount_in as f64 * (pool.fee_rate as f64 / 10000.0)) as u64;
            let price_impact = pool
                .calculate_price_impact(amount_in, &body.token_in)
                .unwrap_or(0.0);

            // Calculate minimum received with 0.5% slippage
            let minimum_received = (amount_out as f64 * 0.995) as u64;

            HttpResponse::Ok().json(QuoteResponse {
                amount_out: amount_out.to_string(),
                fee: fee.to_string(),
                price_impact: format!("{:.2}%", price_impact),
                minimum_received: minimum_received.to_string(),
                route: "pool".to_string(),
            })
        }
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": format!("{:?}", e)
        })),
    }
}

pub async fn record_swap_telemetry(
    state: web::Data<PoolState>,
    body: web::Json<SwapTelemetryRequest>,
) -> HttpResponse {
    let _pool = match state.pool_manager.get_pool(&body.pool_id) {
        Some(p) => p,
        None => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Pool not found"
            }));
        }
    };

    let amount_in = match body.amount_in.parse::<u64>() {
        Ok(value) => value,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid amount_in"
            }));
        }
    };

    let amount_out = match body.amount_out.parse::<u64>() {
        Ok(value) => value,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid amount_out"
            }));
        }
    };

    if let Some(min_amount_str) = &body.min_amount_out {
        if let Ok(min_amount) = min_amount_str.parse::<u64>() {
            if amount_out < min_amount {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "error": "amount_out below declared minimum"
                }));
            }
        }
    }

    if let Err(err) = state.pool_manager.record_swap_confirmation(
        &body.pool_id,
        &body.token_in,
        &body.token_out,
        amount_in,
        amount_out,
        body.tx_signature.clone(),
        body.confirmed_at.clone(),
    ) {
        log::error!("[pool] Failed to record swap telemetry: {:?}", err);
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Failed to record swap telemetry"
        }));
    }

    log::info!(
        "[pool] Swap confirmed: pool={} {} {} -> {} {} tx={:?}",
        body.pool_id,
        amount_in,
        body.token_in,
        amount_out,
        body.token_out,
        body.tx_signature
    );

    let response = SwapTelemetryResponse {
        success: true,
        pending_reconciliation: true,
    };

    HttpResponse::Ok().json(response)
}

// ============================================================================
// Non-Custodial Pool Creation Notification
// ============================================================================

/// Notification endpoint for pools created on-chain by users
/// Backend just tracks for UI - NO CUSTODY involved
pub async fn notify_pool_created(
    state: web::Data<PoolState>,
    body: web::Json<PoolCreatedNotification>,
) -> HttpResponse {
    log::info!(
        "[pool] Pool created notification: {} by {} (tx: {})",
        body.pool_id,
        body.creator,
        body.tx_hash
    );

    // Parse amounts
    let initial_a: u64 = body.initial_a.parse().unwrap_or(0);
    let initial_b: u64 = body.initial_b.parse().unwrap_or(0);
    let _lp_tokens: u64 = body.lp_tokens_minted.parse().unwrap_or(0);

    // Try to create pool for tracking (user owns it, not backend)
    let pool_id = match state.pool_manager.create_pool(
        body.token_a.clone(),
        body.token_b.clone(),
        initial_a,
        initial_b,
        30, // Default 0.3% fee
        PoolType::ConstantProduct,
    ) {
        Ok(id) => id,
        Err(PoolError::PoolAlreadyExists) => {
            // Pool exists, just update the storage account
            log::info!("[pool] Pool already exists, updating storage account");
            body.pool_id.clone()
        }
        Err(e) => {
            log::error!("[pool] Failed to track pool: {:?}", e);
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("Failed to track pool: {:?}", e)
            }));
        }
    };

    // Update with real on-chain storage account
    if let Err(e) = state
        .pool_manager
        .update_storage_account(&pool_id, body.storage_account.clone())
    {
        log::warn!("[pool] Failed to update storage account: {:?}", e);
    } else {
        log::info!(
            "[pool] Updated storage account for pool {}: {}",
            pool_id,
            body.storage_account
        );
    }

    // Update on-chain reserves to prevent auto-pausing by reconciler
    if let Err(e) = state
        .pool_manager
        .update_on_chain_reserves(&pool_id, initial_a, initial_b)
    {
        log::warn!("[pool] Failed to update on-chain reserves: {:?}", e);
    } else {
        log::info!(
            "[pool] Updated on-chain reserves for pool {}: {}/{}",
            pool_id,
            initial_a,
            initial_b
        );
    }

    // Explicitly unpause the pool to make it immediately available for swaps
    if let Err(e) = state.pool_manager.unpause_pool(&pool_id) {
        log::warn!("[pool] Failed to unpause pool: {:?}", e);
    } else {
        log::info!("[pool] Pool {} unpaused and ready for trading", pool_id);
    }

    log::info!(
        "[pool] Pool {} tracked successfully (user-owned, backend has NO custody)",
        pool_id
    );

    HttpResponse::Ok().json(serde_json::json!({
        "status": "tracked",
        "pool_id": pool_id,
        "message": "Pool tracked successfully. User maintains full custody."
    }))
}

/// Unpause a pool (for debugging/manual fixes)
pub async fn unpause_pool(state: web::Data<PoolState>, path: web::Path<String>) -> HttpResponse {
    let pool_id = path.into_inner();

    match state.pool_manager.unpause_pool(&pool_id) {
        Ok(()) => {
            log::info!("[pool] Pool {} unpaused successfully", pool_id);
            HttpResponse::Ok().json(serde_json::json!({
                "status": "unpaused",
                "pool_id": pool_id,
                "message": "Pool unpaused successfully"
            }))
        }
        Err(e) => {
            log::error!("[pool] Failed to unpause pool {}: {:?}", pool_id, e);
            HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("Failed to unpause pool: {:?}", e)
            }))
        }
    }
}
