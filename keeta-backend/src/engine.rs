use dashmap::DashMap;
use tokio::sync::{
    mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
    oneshot,
};
use uuid::Uuid;

use crate::ledger::Ledger;
use crate::models::{LimitOrder, PlacedOrder, Side};

#[derive(thiserror::Error, Debug)]
pub enum EngineError {
    #[error("invalid market symbol")]
    InvalidMarket,
    #[error("insufficient balance")]
    InsufficientBalance,
    #[error("internal engine error")]
    Internal,
    #[error("order not found")]
    OrderNotFound,
}

pub enum EngineCmd {
    Place {
        user_id: String,
        order: LimitOrder,
        resp: oneshot::Sender<Result<PlacedOrder, EngineError>>,
    },
    Cancel {
        user_id: String,
        id: String,
        resp: oneshot::Sender<Result<(), EngineError>>,
    },
}

#[derive(Clone)]
pub struct Engine {
    tx_cmd: UnboundedSender<EngineCmd>,
}

impl Engine {
    pub fn new(tx_cmd: UnboundedSender<EngineCmd>) -> Self {
        Self { tx_cmd }
    }

    pub async fn place_order(
        &self,
        user_id: String,
        order: LimitOrder,
    ) -> Result<PlacedOrder, EngineError> {
        let (tx, rx) = oneshot::channel();
        self.tx_cmd
            .send(EngineCmd::Place {
                user_id,
                order,
                resp: tx,
            })
            .map_err(|_| EngineError::Internal)?;
        rx.await.unwrap_or(Err(EngineError::Internal))
    }

    pub async fn cancel_order(&self, user_id: String, id: String) -> Result<(), EngineError> {
        let (tx, rx) = oneshot::channel();
        self.tx_cmd
            .send(EngineCmd::Cancel {
                user_id,
                id,
                resp: tx,
            })
            .map_err(|_| EngineError::Internal)?;
        rx.await.unwrap_or(Err(EngineError::Internal))
    }
}

fn parse_market(market: &str) -> Option<(String, String)> {
    let mut parts = market.split('/');
    let base = parts.next()?.trim();
    let quote = parts.next()?.trim();
    if parts.next().is_some() {
        return None;
    }
    if base.is_empty() || quote.is_empty() {
        return None;
    }
    Some((base.to_string(), quote.to_string()))
}

fn handle_place(
    ledger: &Ledger,
    open_orders: &DashMap<String, (String, LimitOrder, f64)>,
    user_id: String,
    order: LimitOrder,
) -> Result<PlacedOrder, EngineError> {
    let (base, quote) = parse_market(&order.market).ok_or(EngineError::InvalidMarket)?;
    let price: f64 = order
        .price
        .parse()
        .map_err(|_| EngineError::InvalidMarket)?;
    let quantity: f64 = order
        .quantity
        .parse()
        .map_err(|_| EngineError::InvalidMarket)?;

    let (reserve_token, reserve_amount) = match order.side {
        Side::Buy => (quote.clone(), price * quantity),
        Side::Sell => (base.clone(), quantity),
    };

    if !ledger.reserve(&user_id, &reserve_token, reserve_amount) {
        return Err(EngineError::InsufficientBalance);
    }

    let id = Uuid::new_v4().to_string();
    open_orders.insert(id.clone(), (user_id.clone(), order.clone(), reserve_amount));

    Ok(PlacedOrder {
        id,
        order,
        status: "open".to_string(),
        filled_quantity: "0".to_string(),
    })
}

fn handle_cancel(
    ledger: &Ledger,
    open_orders: &DashMap<String, (String, LimitOrder, f64)>,
    user_id: String,
    id: String,
) -> Result<(), EngineError> {
    if let Some((owner, order, reserved)) = open_orders.remove(&id).map(|(_, v)| v) {
        if owner != user_id {
            // Put order back since we are denying cancellation.
            open_orders.insert(id, (owner, order, reserved));
            return Err(EngineError::Internal);
        }
        let (base, quote) = parse_market(&order.market).ok_or(EngineError::InvalidMarket)?;
        let price: f64 = order
            .price
            .parse()
            .map_err(|_| EngineError::InvalidMarket)?;
        let quantity: f64 = order
            .quantity
            .parse()
            .map_err(|_| EngineError::InvalidMarket)?;

        let token = match order.side {
            Side::Buy => quote,
            Side::Sell => base,
        };

        let amount = match order.side {
            Side::Buy => price * quantity,
            Side::Sell => quantity,
        };

        ledger.release(&user_id, &token, amount.min(reserved));
        return Ok(());
    }

    Err(EngineError::OrderNotFound)
}

fn run_engine(mut rx_cmd: UnboundedReceiver<EngineCmd>, ledger: Ledger) {
    let open_orders: DashMap<String, (String, LimitOrder, f64)> = DashMap::new();

    actix_rt::spawn(async move {
        while let Some(cmd) = rx_cmd.recv().await {
            match cmd {
                EngineCmd::Place {
                    user_id,
                    order,
                    resp,
                } => {
                    let result = handle_place(&ledger, &open_orders, user_id, order);
                    let _ = resp.send(result);
                }
                EngineCmd::Cancel { user_id, id, resp } => {
                    let result = handle_cancel(&ledger, &open_orders, user_id, id);
                    let _ = resp.send(result);
                }
            }
        }
    });
}

pub fn start_engine(ledger: Ledger) -> Engine {
    let (tx_cmd, rx_cmd) = unbounded_channel::<EngineCmd>();
    run_engine(rx_cmd, ledger);
    Engine::new(tx_cmd)
}
