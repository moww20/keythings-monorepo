use log::{error, info};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use uuid::Uuid;

use crate::keeta::KeetaClient;
use crate::ledger::Ledger;
use crate::models::{WithdrawEnqueued, WithdrawRequest};

#[derive(Clone)]
pub struct SettlementQueue {
    tx: UnboundedSender<QueuedWithdrawal>,
    ledger: Ledger,
}

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
        let job = QueuedWithdrawal {
            id: id.clone(),
            request,
            amount,
        };
        if let Err(err) = self.tx.send(job) {
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
}

fn spawn_worker(mut rx: UnboundedReceiver<QueuedWithdrawal>, client: KeetaClient, ledger: Ledger) {
    tokio::spawn(async move {
        while let Some(job) = rx.recv().await {
            info!("processing withdrawal {}", job.id);
            match client.send_on_behalf(&job.request).await {
                Ok(tx_id) => {
                    info!("withdrawal {} settled on-chain (tx={})", job.id, tx_id);
                    ledger.complete_withdrawal(
                        &job.id,
                        &job.request.user_id,
                        &job.request.token,
                        job.amount,
                        &tx_id,
                    );
                }
                Err(err) => {
                    let message = err.to_string();
                    report_error(&job.id, &message);
                    ledger.fail_withdrawal(
                        &job.id,
                        &job.request.user_id,
                        &job.request.token,
                        job.amount,
                        &message,
                    );
                }
            }
        }
    });
}

fn report_error(id: &str, err: &str) {
    error!("withdrawal {} failed: {}", id, err);
}
