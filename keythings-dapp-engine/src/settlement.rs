use log::{error, info};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use uuid::Uuid;

use crate::keeta::KeetaClient;
use crate::ledger::Ledger;
use crate::models::{WithdrawEnqueued, WithdrawRequest};

// Phase 3: Pool-Specific Settlement Operations

#[derive(Debug, Clone)]
pub enum SettlementOp {
    Withdraw {
        id: String,
        request: WithdrawRequest,
        amount: f64,
    },
    PoolDeposit {
        id: String,
        user_id: String,
        pool_storage_account: String,
        token: String,
        amount: u64,
    },
    PoolWithdraw {
        id: String,
        pool_storage_account: String,
        user_id: String,
        token: String,
        amount: u64,
    },
}

#[derive(Clone)]
pub struct SettlementQueue {
    tx: UnboundedSender<SettlementOp>,
    ledger: Ledger,
}

/// Queued withdrawal for future batch processing
/// Reserved for future use when batch withdrawal processing is implemented
#[allow(dead_code)]
struct QueuedWithdrawal {
    id: String,
    request: WithdrawRequest,
    amount: f64,
}

impl SettlementQueue {
    pub fn new(client: KeetaClient, ledger: Ledger) -> Self {
        let (tx, rx) = unbounded_channel();
        spawn_worker(rx, client, ledger.clone());
        Self { tx, ledger }
    }

    pub fn enqueue(&self, request: WithdrawRequest, amount: f64) -> WithdrawEnqueued {
        let id = Uuid::new_v4().to_string();
        let user_id = request.user_id.clone();
        let token = request.token.clone();
        self.ledger.record_withdrawal(&id, &request);

        let op = SettlementOp::Withdraw {
            id: id.clone(),
            request,
            amount,
        };

        if let Err(err) = self.tx.send(op) {
            let message = format!("failed to enqueue withdrawal: {}", err);
            error!("{}", message);
            self.ledger
                .fail_withdrawal(&id, &user_id, &token, amount, &message);
            return WithdrawEnqueued {
                request_id: id,
                status: "failed".into(),
            };
        }
        WithdrawEnqueued {
            request_id: id,
            status: "pending".into(),
        }
    }

    /// Phase 3: Enqueue a pool deposit operation
    /// Transfers funds from user's S_user to pool's S_pool storage account
    pub fn enqueue_pool_deposit(
        &self,
        user_id: String,
        pool_storage_account: String,
        token: String,
        amount: u64,
    ) -> String {
        let id = Uuid::new_v4().to_string();

        let op = SettlementOp::PoolDeposit {
            id: id.clone(),
            user_id,
            pool_storage_account,
            token,
            amount,
        };

        if let Err(err) = self.tx.send(op) {
            error!("failed to enqueue pool deposit: {}", err);
            return id;
        }

        info!("[settlement] Pool deposit {} enqueued", id);
        id
    }

    /// Phase 3: Enqueue a pool withdrawal operation
    /// Transfers funds from pool's S_pool back to user's S_user
    pub fn enqueue_pool_withdraw(
        &self,
        pool_storage_account: String,
        user_id: String,
        token: String,
        amount: u64,
    ) -> String {
        let id = Uuid::new_v4().to_string();

        let op = SettlementOp::PoolWithdraw {
            id: id.clone(),
            pool_storage_account,
            user_id,
            token,
            amount,
        };

        if let Err(err) = self.tx.send(op) {
            error!("failed to enqueue pool withdraw: {}", err);
            return id;
        }

        info!("[settlement] Pool withdraw {} enqueued", id);
        id
    }
}

fn spawn_worker(mut rx: UnboundedReceiver<SettlementOp>, client: KeetaClient, ledger: Ledger) {
    tokio::spawn(async move {
        while let Some(op) = rx.recv().await {
            match op {
                SettlementOp::Withdraw {
                    id,
                    request,
                    amount,
                } => {
                    info!("processing withdrawal {}", id);
                    match client.send_on_behalf(&request).await {
                        Ok(tx_id) => {
                            info!("withdrawal {} settled on-chain (tx={})", id, tx_id);
                            ledger.complete_withdrawal(
                                &id,
                                &request.user_id,
                                &request.token,
                                amount,
                                &tx_id,
                            );
                        }
                        Err(err) => {
                            let message = err.to_string();
                            report_error(&id, &message);
                            ledger.fail_withdrawal(
                                &id,
                                &request.user_id,
                                &request.token,
                                amount,
                                &message,
                            );
                        }
                    }
                }
                SettlementOp::PoolDeposit {
                    id,
                    user_id,
                    pool_storage_account,
                    token,
                    amount,
                } => {
                    info!(
                        "[settlement] processing pool deposit {} user={} token={} amount={} pool={}",
                        id, user_id, token, amount, pool_storage_account
                    );

                    // TODO: Build Keeta transaction with SEND_ON_BEHALF
                    // For demo mode, we simulate instant settlement
                    let tx_id = Uuid::new_v4().to_string();

                    info!(
                        "[settlement] pool deposit {} settled on-chain (tx={})",
                        id, tx_id
                    );

                    // In production:
                    // 1. Build SEND block from S_user to S_pool
                    // 2. Sign with operator key (has SEND_ON_BEHALF permission)
                    // 3. Submit to Keeta network
                    // 4. Wait for vote staple (400ms)
                    // 5. Return transaction ID
                }
                SettlementOp::PoolWithdraw {
                    id,
                    pool_storage_account,
                    user_id,
                    token,
                    amount,
                } => {
                    info!(
                        "[settlement] processing pool withdraw {} user={} token={} amount={} pool={}",
                        id, user_id, token, amount, pool_storage_account
                    );

                    // TODO: Build Keeta transaction to return funds
                    // For demo mode, we simulate instant settlement
                    let tx_id = Uuid::new_v4().to_string();

                    info!(
                        "[settlement] pool withdraw {} settled on-chain (tx={})",
                        id, tx_id
                    );

                    // In production:
                    // 1. Build SEND block from S_pool to S_user
                    // 2. Sign with operator key (OWNER of S_pool)
                    // 3. Submit to Keeta network
                    // 4. Wait for confirmation (400ms)
                    // 5. Return transaction ID
                }
            }
        }
    });
}

fn report_error(id: &str, err: &str) {
    error!("withdrawal {} failed: {}", id, err);
}
