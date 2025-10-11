use std::time::Duration;

use log::info;
use tokio::time::interval;

use crate::ledger::Ledger;
use crate::models::Balance;

#[derive(Clone)]
pub struct Reconciler {
    ledger: Ledger,
}

impl Reconciler {
    pub fn new(ledger: Ledger) -> Self {
        let reconciler = Self {
            ledger: ledger.clone(),
        };
        reconciler.spawn_background();
        reconciler
    }

    fn spawn_background(&self) {
        let ledger = self.ledger.clone();
        tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(30));
            loop {
                ticker.tick().await;
                info!(
                    "reconciliation tick: {} accounts tracked",
                    ledger.balances.len()
                );
            }
        });
    }

    pub fn snapshot_balances(&self, user: &str) -> Vec<Balance> {
        self.ledger.list_balances(user)
    }
}
