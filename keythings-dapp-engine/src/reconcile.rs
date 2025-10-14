use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use log::{info, warn};
use tokio::time::interval;

use crate::ledger::Ledger;
use crate::models::Balance;
use crate::keeta::KeetaClient;
use crate::pool::PoolManager;

const RECONCILE_INTERVAL_SECS: u64 = 300;
const AUTO_CORRECT_THRESHOLD: f64 = 0.0001;

// Phase 5: Pool reconciliation result
#[derive(Debug, Clone)]
pub struct PoolReconcileResult {
    pub pool_id: String,
    pub drift_a: i64,
    pub drift_b: i64,
    pub status: String,
}

#[derive(Clone)]
pub struct Reconciler {
    ledger: Ledger,
    reports: Arc<DashMap<(String, String), AccountReport>>,
    keeta_client: Option<KeetaClient>,      // Phase 5: For querying on-chain balances
    pool_manager: Option<PoolManager>,       // Phase 5: For pool reconciliation
}

impl Reconciler {
    /// Create a new reconciler instance
    /// Reserved for future use when reconciliation service is enabled
    #[allow(dead_code)]
    pub fn new(ledger: Ledger) -> Self {
        let reconciler = Self {
            ledger: ledger.clone(),
            reports: Arc::new(DashMap::new()),
            keeta_client: None,
            pool_manager: None,
        };
        reconciler.spawn_background();
        reconciler
    }

    /// Phase 5: Initialize with pool manager and keeta client for pool reconciliation
    pub fn with_pool_support(
        ledger: Ledger,
        keeta_client: KeetaClient,
        pool_manager: PoolManager,
    ) -> Self {
        let reconciler = Self {
            ledger: ledger.clone(),
            reports: Arc::new(DashMap::new()),
            keeta_client: Some(keeta_client),
            pool_manager: Some(pool_manager),
        };
        reconciler.spawn_background();
        reconciler
    }

    fn spawn_background(&self) {
        let ledger = self.ledger.clone();
        let reports = self.reports.clone();
        tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(RECONCILE_INTERVAL_SECS));
            // run immediately before waiting for the first tick
            run_once(&ledger, &reports).await;
            loop {
                ticker.tick().await;
                run_once(&ledger, &reports).await;
            }
        });
    }

    pub fn snapshot_balances(&self, user: &str) -> Vec<Balance> {
        let mut balances = self.ledger.list_balances(user);
        for balance in &mut balances {
            let key = (user.to_string(), balance.token.clone());
            if let Some(report) = self.reports.get(&key) {
                let report = report.value();
                balance.status = report.status.as_str().to_string();
                balance.last_reconciled_at = Some(report.last_checked.to_rfc3339());
                balance.on_chain = display_amount(report.on_chain);
                balance.drift = display_amount(report.drift);
            }
        }
        balances
    }

    /// Phase 5: Reconcile a specific pool's reserves with on-chain balances
    /// 
    /// NON-CUSTODIAL MODEL: This method is QUERY-ONLY
    /// - Queries on-chain balances (read-only)
    /// - Updates internal tracking to match chain (UI state only)
    /// - Pauses pool if drift detected (safety mechanism)
    /// - CANNOT fix drift on-chain (no operator key, by design)
    /// 
    /// In non-custodial architecture, only the pool owner (user) can fix drift
    /// by signing transactions via their wallet.
    pub async fn reconcile_pool(&self, pool_id: &str) -> Result<PoolReconcileResult, String> {
        let keeta_client = self.keeta_client.as_ref()
            .ok_or_else(|| "Keeta client not initialized".to_string())?;
        
        let pool_manager = self.pool_manager.as_ref()
            .ok_or_else(|| "Pool manager not initialized".to_string())?;
        
        let pool = pool_manager.get_pool(pool_id)
            .ok_or_else(|| format!("Pool not found: {}", pool_id))?;
        
        info!("[reconcile] Reconciling pool: {} (READ-ONLY query)", pool_id);
        
        // STEP 1: Query on-chain balances (READ-ONLY - cannot modify)
        let on_chain_a = keeta_client
            .verify_pool_reserves(&pool.on_chain_storage_account, &pool.token_a)
            .await
            .unwrap_or(0);
        
        let on_chain_b = keeta_client
            .verify_pool_reserves(&pool.on_chain_storage_account, &pool.token_b)
            .await
            .unwrap_or(0);
        
        // STEP 2: Compare with internal tracking (not on-chain state)
        let drift_a = (on_chain_a as i64) - (pool.reserve_a as i64);
        let drift_b = (on_chain_b as i64) - (pool.reserve_b as i64);
        
        let status = if drift_a == 0 && drift_b == 0 {
            info!("[reconcile] Pool {} is healthy (no drift)", pool_id);
            "ok".to_string()
        } else {
            warn!(
                "[reconcile] Pool {} drift detected: token_a={} token_b={} (on-chain: {}/{}, internal: {}/{})",
                pool_id, drift_a, drift_b, on_chain_a, on_chain_b, pool.reserve_a, pool.reserve_b
            );
            warn!(
                "[reconcile] Backend CANNOT fix drift (no operator key by design). Pool owner must fix via wallet."
            );
            
            // STEP 3: Auto-pause pool (safety) - only affects backend UI state
            if let Err(e) = pool_manager.pause_pool(pool_id) {
                warn!("[reconcile] Failed to auto-pause pool {}: {:?}", pool_id, e);
            } else {
                warn!("[reconcile] Pool {} AUTO-PAUSED in UI (backend state only)", pool_id);
            }
            
            "drift".to_string()
        };
        
        // STEP 4: Update internal tracking (UI state only - NOT on-chain)
        let now = Utc::now().to_rfc3339();
        if let Err(e) = pool_manager.update_reconciliation(pool_id, on_chain_a, on_chain_b, now) {
            warn!("[reconcile] Failed to update reconciliation status: {:?}", e);
        }
        
        Ok(PoolReconcileResult {
            pool_id: pool_id.to_string(),
            drift_a,
            drift_b,
            status,
        })
    }

    /// Phase 5: Reconcile all pools
    pub async fn reconcile_all_pools(&self) {
        let pool_manager = match &self.pool_manager {
            Some(pm) => pm,
            None => {
                warn!("[reconcile] Pool manager not initialized, skipping pool reconciliation");
                return;
            }
        };
        
        let pools = pool_manager.list_pools();
        info!("[reconcile] Reconciling {} pools", pools.len());
        
        for pool in pools {
            match self.reconcile_pool(&pool.id).await {
                Ok(result) => {
                    info!(
                        "[reconcile] Pool {} result: status={} drift_a={} drift_b={}",
                        result.pool_id, result.status, result.drift_a, result.drift_b
                    );
                }
                Err(e) => {
                    warn!("[reconcile] Failed to reconcile pool {}: {}", pool.id, e);
                }
            }
        }
    }
}

#[derive(Clone)]
struct AccountReport {
    status: AccountStatus,
    on_chain: f64,
    drift: f64,
    last_checked: DateTime<Utc>,
}

#[derive(Clone)]
enum AccountStatus {
    Healthy,
    AutoCorrected,
    Drift,
}

impl AccountStatus {
    fn as_str(&self) -> &'static str {
        match self {
            AccountStatus::Healthy => "healthy",
            AccountStatus::AutoCorrected => "auto_corrected",
            AccountStatus::Drift => "drift_detected",
        }
    }
}

async fn run_once(ledger: &Ledger, reports: &DashMap<(String, String), AccountReport>) {
    let accounts = ledger.account_keys();
    info!("reconciliation tick: {} accounts tracked", accounts.len());
    let now = Utc::now();

    for (user, token) in accounts {
        let (_, internal_total) = ledger.internal_balance(&user, &token);
        let on_chain = ledger.on_chain_balance(&user, &token);
        let initial_diff = on_chain - internal_total;

        let status = if initial_diff.abs() <= f64::EPSILON {
            AccountStatus::Healthy
        } else if initial_diff.abs() <= AUTO_CORRECT_THRESHOLD {
            ledger.adjust_internal_balances(&user, &token, initial_diff);
            info!(
                "auto-corrected minor drift for user={} token={} diff={}",
                user, token, initial_diff
            );
            AccountStatus::AutoCorrected
        } else {
            warn!(
                "reconciliation drift detected user={} token={} diff={} on_chain={} internal={}",
                user, token, initial_diff, on_chain, internal_total
            );
            AccountStatus::Drift
        };

        let (_, corrected_total) = ledger.internal_balance(&user, &token);
        let final_diff = on_chain - corrected_total;

        reports.insert(
            (user.clone(), token.clone()),
            AccountReport {
                status,
                on_chain,
                drift: final_diff,
                last_checked: now,
            },
        );
    }
}

fn display_amount(value: f64) -> String {
    if value.fract().abs() < f64::EPSILON {
        format!("{:.0}", value)
    } else {
        format!("{:.6}", value)
    }
}
