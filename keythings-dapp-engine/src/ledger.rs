use chrono::Utc;
use dashmap::DashMap;
use std::sync::Arc;

use crate::models::{Balance, WithdrawRequest, WithdrawalRecord, WithdrawalStatus};

#[derive(Clone)]
pub struct Ledger {
    pub balances: Arc<DashMap<(String, String), (f64, f64)>>,
    on_chain: Arc<DashMap<(String, String), f64>>,
    withdrawals: Arc<DashMap<String, WithdrawalRecord>>,
}

impl Ledger {
    pub fn new() -> Self {
        Self {
            balances: Arc::new(DashMap::new()),
            on_chain: Arc::new(DashMap::new()),
            withdrawals: Arc::new(DashMap::new()),
        }
    }

    pub fn credit(&self, user: &str, token: &str, amt: f64) {
        let key = (user.to_string(), token.to_string());
        {
            let mut entry = self.balances.entry(key.clone()).or_insert((0.0, 0.0));
            entry.0 += amt;
            entry.1 += amt;
        }
        let mut on_chain = self.on_chain.entry(key).or_insert(0.0);
        *on_chain += amt;
    }

    pub fn reserve(&self, user: &str, token: &str, amt: f64) -> bool {
        let mut entry = self
            .balances
            .entry((user.to_string(), token.to_string()))
            .or_insert((0.0, 0.0));
        if entry.0 < amt {
            return false;
        }
        entry.0 -= amt;
        true
    }

    pub fn release(&self, user: &str, token: &str, amt: f64) {
        let mut entry = self
            .balances
            .entry((user.to_string(), token.to_string()))
            .or_insert((0.0, 0.0));
        entry.0 += amt;
    }

    pub fn debit_total(&self, user: &str, token: &str, amt: f64) {
        let mut entry = self
            .balances
            .entry((user.to_string(), token.to_string()))
            .or_insert((0.0, 0.0));
        entry.1 -= amt;
    }

    pub fn list_balances(&self, user: &str) -> Vec<Balance> {
        self.balances
            .iter()
            .filter(|kv| kv.key().0 == user)
            .map(|kv| Balance {
                token: kv.key().1.clone(),
                available: format_amount(kv.value().0),
                total: format_amount(kv.value().1),
                on_chain: format_amount(self.on_chain_balance(&kv.key().0, &kv.key().1)),
                drift: format_amount(
                    self.on_chain_balance(&kv.key().0, &kv.key().1) - kv.value().1,
                ),
                status: "unknown".into(),
                last_reconciled_at: None,
            })
            .collect()
    }

    pub fn account_keys(&self) -> Vec<(String, String)> {
        self.balances
            .iter()
            .map(|entry| entry.key().clone())
            .collect()
    }

    pub fn internal_balance(&self, user: &str, token: &str) -> (f64, f64) {
        self.balances
            .get(&(user.to_string(), token.to_string()))
            .map(|entry| *entry.value())
            .unwrap_or((0.0, 0.0))
    }

    pub fn on_chain_balance(&self, user: &str, token: &str) -> f64 {
        self.on_chain
            .get(&(user.to_string(), token.to_string()))
            .map(|entry| *entry.value())
            .unwrap_or(0.0)
    }

    pub fn adjust_internal_balances(&self, user: &str, token: &str, diff: f64) {
        let key = (user.to_string(), token.to_string());
        let mut entry = self.balances.entry(key).or_insert((0.0, 0.0));
        let reserved = (entry.1 - entry.0).max(0.0);
        entry.1 = (entry.1 + diff).max(0.0);
        entry.0 = (entry.1 - reserved).max(0.0);
        if entry.0 > entry.1 {
            entry.0 = entry.1;
        }
    }

    pub fn record_withdrawal(&self, id: &str, request: &WithdrawRequest) {
        let record = WithdrawalRecord {
            id: id.to_string(),
            user_id: request.user_id.clone(),
            token: request.token.clone(),
            amount: request.amount.clone(),
            to: request.to.clone(),
            status: WithdrawalStatus::Pending,
            tx_id: None,
            last_error: None,
            updated_at: Some(Utc::now().to_rfc3339()),
        };
        self.withdrawals.insert(id.to_string(), record);
    }

    pub fn complete_withdrawal(&self, id: &str, user: &str, token: &str, amount: f64, tx_id: &str) {
        if let Some(mut record) = self.withdrawals.get_mut(id) {
            record.status = WithdrawalStatus::Completed;
            record.tx_id = Some(tx_id.to_string());
            record.last_error = None;
            record.updated_at = Some(Utc::now().to_rfc3339());
        }
        self.apply_on_chain_withdrawal(user, token, amount);
    }

    pub fn fail_withdrawal(&self, id: &str, user: &str, token: &str, amount: f64, error: &str) {
        if let Some(mut record) = self.withdrawals.get_mut(id) {
            record.status = WithdrawalStatus::Failed;
            record.last_error = Some(error.to_string());
            record.updated_at = Some(Utc::now().to_rfc3339());
            record.tx_id = None;
        }
        self.revert_withdrawal(user, token, amount);
    }

    fn revert_withdrawal(&self, user: &str, token: &str, amount: f64) {
        let mut entry = self
            .balances
            .entry((user.to_string(), token.to_string()))
            .or_insert((0.0, 0.0));
        entry.0 += amount;
        entry.1 += amount;
    }

    fn apply_on_chain_withdrawal(&self, user: &str, token: &str, amount: f64) {
        let mut on_chain = self
            .on_chain
            .entry((user.to_string(), token.to_string()))
            .or_insert(0.0);
        *on_chain = (*on_chain - amount).max(0.0);
    }
}

fn format_amount(value: f64) -> String {
    if value.fract().abs() < f64::EPSILON {
        format!("{:.0}", value)
    } else {
        format!("{:.6}", value)
    }
}
