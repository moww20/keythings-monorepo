use dashmap::DashMap;
use std::sync::Arc;

use crate::models::Balance;

#[derive(Clone)]
pub struct Ledger {
    pub balances: Arc<DashMap<(String, String), (f64, f64)>>,
}

impl Ledger {
    pub fn new() -> Self {
        Self {
            balances: Arc::new(DashMap::new()),
        }
    }

    pub fn credit(&self, user: &str, token: &str, amt: f64) {
        let mut entry = self
            .balances
            .entry((user.to_string(), token.to_string()))
            .or_insert((0.0, 0.0));
        entry.0 += amt;
        entry.1 += amt;
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
                available: format!("{}", kv.value().0),
                total: format!("{}", kv.value().1),
            })
            .collect()
    }
}
