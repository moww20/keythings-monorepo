use log::{error, info};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use uuid::Uuid;

use crate::keeta::{KeetaClient, KeetaError};
use crate::models::{WithdrawEnqueued, WithdrawRequest};

#[derive(Clone)]
pub struct SettlementQueue {
    tx: UnboundedSender<QueuedWithdrawal>,
}

struct QueuedWithdrawal {
    id: String,
    request: WithdrawRequest,
}

impl SettlementQueue {
    pub fn new(client: KeetaClient) -> Self {
        let (tx, rx) = unbounded_channel();
        spawn_worker(rx, client);
        Self { tx }
    }

    pub fn enqueue(&self, request: WithdrawRequest) -> WithdrawEnqueued {
        let id = Uuid::new_v4().to_string();
        let job = QueuedWithdrawal {
            id: id.clone(),
            request,
        };
        if let Err(err) = self.tx.send(job) {
            error!("failed to enqueue withdrawal: {}", err);
        }
        WithdrawEnqueued { request_id: id }
    }
}

impl Default for SettlementQueue {
    fn default() -> Self {
        Self::new(KeetaClient::new_from_env())
    }
}

fn spawn_worker(mut rx: UnboundedReceiver<QueuedWithdrawal>, client: KeetaClient) {
    tokio::spawn(async move {
        while let Some(job) = rx.recv().await {
            info!("processing withdrawal {}", job.id);
            if let Err(err) = client.send_on_behalf(&job.request).await {
                report_error(&job.id, err);
            }
        }
    });
}

fn report_error(id: &str, err: KeetaError) {
    error!("withdrawal {} failed: {}", id, err);
}
