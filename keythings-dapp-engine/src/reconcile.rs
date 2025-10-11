use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use log::{info, warn};
use tokio::time::interval;

use crate::ledger::Ledger;
use crate::models::Balance;

const RECONCILE_INTERVAL_SECS: u64 = 300;
const AUTO_CORRECT_THRESHOLD: f64 = 0.0001;

#[derive(Clone)]
pub struct Reconciler {
    ledger: Ledger,
    reports: Arc<DashMap<(String, String), AccountReport>>,
}

impl Reconciler {
    pub fn new(ledger: Ledger) -> Self {
        let reconciler = Self {
            ledger: ledger.clone(),
            reports: Arc::new(DashMap::new()),
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
