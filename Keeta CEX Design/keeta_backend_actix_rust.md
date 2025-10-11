# Keeta CEX – Backend/Engine (Rust + Actix-web)

A reference backend implementing:
- **Auth (challenge/response)** using users' Keeta keys
- **Order Gateway + CLOB Matching Engine**
- **Internal Ledger** (in-memory for demo, replace with Postgres)
- **Settlement Orchestrator** using delegated `SEND_ON_BEHALF`
- **Reconciliation worker** (stub) to compare on-chain `S_user` vs. internal balances

> Structure
```
keeta-backend/
├─ Cargo.toml
└─ src/
   ├─ main.rs
   ├─ api.rs
   ├─ models.rs
   ├─ engine.rs
   ├─ ledger.rs         # internal double-entry
   ├─ keeta.rs          # Keeta RPC shim (send_on_behalf)
   ├─ settlement.rs     # withdrawal queue + on-chain SENDs
   └─ reconcile.rs      # checkpoint reads & diffs
```
---

## Cargo.toml
```toml
[package]
name = "keeta-backend"
version = "0.1.0"
edition = "2021"

[dependencies]
actix-web = "4"
actix-rt = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
tokio = { version = "1", features = ["macros", "rt-multi-thread", "sync", "time"] }
dashmap = "5"
thiserror = "1"
env_logger = "0.11"
log = "0.4"
```

---

## src/models.rs
```rust
use serde::{Deserialize, Serialize};

pub type PubKey58 = String;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthChallenge { pub nonce: String }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthSession { pub user_id: String, pub jwt: String }

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all="lowercase")]
pub enum Side { Buy, Sell }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LimitOrder {
    pub market: String,
    pub side: Side,
    pub price: String,      // decimal as string
    pub quantity: String,   // decimal as string
    pub tif: Option<String> // gtc/ioc/postonly
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlacedOrder {
    pub id: String,
    #[serde(flatten)]
    pub order: LimitOrder,
    pub status: String,
    pub filled_quantity: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Balance {
    pub token: String,
    pub available: String,
    pub total: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WithdrawRequest {
    pub token: String,
    pub amount: String,
    pub to: PubKey58,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaceOrderResponse { pub order: PlacedOrder }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CancelOrderRequest { pub id: String }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WithdrawEnqueued { pub request_id: String }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DepositAddress { pub storage_account: String }
```

---

## src/ledger.rs (in-memory double-entry for demo)
```rust
use dashmap::DashMap;
use std::sync::Arc;
use uuid::Uuid;
use crate::models::{Balance};

#[derive(Clone)]
pub struct Ledger {
    // key: (user_id, token) -> (available, total)
    pub balances: Arc<DashMap<(String, String), (f64, f64)>>,
}

impl Ledger {
    pub fn new() -> Self {
        Self { balances: Arc::new(DashMap::new()) }
    }

    pub fn credit(&self, user: &str, token: &str, amt: f64) {
        let mut e = self.balances.entry((user.to_string(), token.to_string())).or_insert((0.0, 0.0));
        e.0 += amt; e.1 += amt;
    }

    pub fn reserve(&self, user: &str, token: &str, amt: f64) -> bool {
        let mut e = self.balances.entry((user.to_string(), token.to_string())).or_insert((0.0, 0.0));
        if e.0 < amt { return false; }
        e.0 -= amt; // reduce available
        true
    }

    pub fn release(&self, user: &str, token: &str, amt: f64) {
        let mut e = self.balances.entry((user.to_string(), token.to_string())).or_insert((0.0, 0.0));
        e.0 += amt;
    }

    pub fn transfer_internal(&self, from: &str, to: &str, token: &str, amt: f64) {
        // assume from's available already reserved
        let mut ef = self.balances.entry((from.to_string(), token.to_string())).or_insert((0.0, 0.0));
        ef.1 -= amt;
        let mut et = self.balances.entry((to.to_string(), token.to_string())).or_insert((0.0, 0.0));
        et.0 += amt; et.1 += amt;
    }

    pub fn list_balances(&self, user: &str) -> Vec<Balance> {
        self.balances.iter()
          .filter(|kv| kv.key().0 == user)
          .map(|kv| Balance {
            token: kv.key().1.clone(),
            available: format!("{}", kv.value().0),
            total: format!("{}", kv.value().1),
          })
          .collect()
    }
}
```

---

## src/engine.rs (CLOB + matching loop)
```rust
use std::collections::{BTreeMap, VecDeque};
use std::sync::Arc;
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender, UnboundedReceiver};
use uuid::Uuid;
use crate::models::{LimitOrder, PlacedOrder, Side};
use crate::ledger::Ledger;

#[derive(Clone)]
pub struct Engine {
    pub ledger: Ledger,
    pub tx_cmd: UnboundedSender<EngineCmd>,
}

pub enum EngineCmd {
    Place { user_id: String, order: LimitOrder, resp: tokio::sync::oneshot::Sender<PlacedOrder> },
    Cancel { user_id: String, id: String },
}

pub fn start_engine(ledger: Ledger) -> Engine {
    let (tx_cmd, mut rx_cmd) = unbounded_channel::<EngineCmd>();

    // orderbooks per market
    let mut bids: BTreeMap<String, BTreeMap<String, VecDeque<(String, String)>>> = BTreeMap::new(); // market -> price -> queue of (order_id, user_id)
    let mut asks: BTreeMap<String, BTreeMap<String, VecDeque<(String, String)>>> = BTreeMap::new();

    tokio::spawn(async move {
        while let Some(cmd) = rx_cmd.recv().await {
            match cmd {
                EngineCmd::Place { user_id, order, resp } => {
                    // reserve balance
                    let (base, quote) = parse_market(&order.market);
                    let ok = match order.side {
                        Side::Buy => ledger.reserve(&user_id, quote, order_cost(&order)),
                        Side::Sell => ledger.reserve(&user_id, base, order_qty(&order)),
                    };
                    let id = Uuid::new_v4().to_string();
                    if !ok {
                        let _ = resp.send(PlacedOrder {
                            id, order, status: "rejected".into(), filled_quantity: "0".into()
                        });
                        continue;
                    }

                    // add to book
                    match order.side {
                        Side::Buy => {
                            bids.entry(order.market.clone()).or_default()
                                .entry(order.price.clone()).or_default()
                                .push_back((id.clone(), user_id.clone()));
                        }
                        Side::Sell => {
                            asks.entry(order.market.clone()).or_default()
                                .entry(order.price.clone()).or_default()
                                .push_back((id.clone(), user_id.clone()));
                        }
                    }

                    // naive matching: cross best levels
                    match_loop(&order.market, &ledger, &mut bids, &mut asks);

                    let _ = resp.send(PlacedOrder {
                        id, order, status: "resting".into(), filled_quantity: "0".into()
                    });
                }
                EngineCmd::Cancel { .. } => {
                    // TODO: implement (remove from queues + release reserve)
                }
            }
        }
    });

    Engine { ledger, tx_cmd }
}

fn parse_market(m: &str) -> (String, String) {
    let parts: Vec<_> = m.split('/').collect();
    (parts[0].to_string(), parts[1].to_string())
}

fn order_qty(o: &LimitOrder) -> f64 { o.quantity.parse().unwrap_or(0.0) }
fn order_cost(o: &LimitOrder) -> f64 { o.price.parse::<f64>().unwrap_or(0.0) * order_qty(o) }

fn match_loop(
    market: &String,
    ledger: &Ledger,
    bids: &mut BTreeMap<String, BTreeMap<String, VecDeque<(String, String)>>>,
    asks: &mut BTreeMap<String, BTreeMap<String, VecDeque<(String, String)>>>,
) {
    let (base, quote) = parse_market(market);
    let mut best_bid = bids.get_mut(market);
    let mut best_ask = asks.get_mut(market);
    if best_bid.is_none() || best_ask.is_none() { return; }

    // Simplified: not price-time optimal; demo only
    let (mut bb, mut ba) = (best_bid.unwrap(), best_ask.unwrap());
    if bb.is_empty() || ba.is_empty() { return; }

    let best_bid_px = bb.keys().last().cloned();
    let best_ask_px = ba.keys().next().cloned();
    if best_bid_px.is_none() || best_ask_px.is_none() { return; }

    let (bid_px, ask_px) = (best_bid_px.unwrap(), best_ask_px.unwrap());
    if bid_px.parse::<f64>().unwrap_or(0.0) < ask_px.parse::<f64>().unwrap_or(0.0) { return; }

    // fill single unit for demo
    if let (Some((bid_id, bid_user)), Some((ask_id, ask_user))) = (
        bb.get_mut(&bid_px).and_then(|q| q.pop_front()),
        ba.get_mut(&ask_px).and_then(|q| q.pop_front())
    ) {
        let qty = 1.0; // demo
        let price = ask_px.parse::<f64>().unwrap_or(0.0);

        // buyer pays quote, receives base; seller receives quote, gives base
        ledger.transfer_internal(&bid_user, &ask_user, &quote, qty * price);
        ledger.transfer_internal(&ask_user, &bid_user, &base, qty);
    }
}
```

---

## src/keeta.rs (RPC shim; delegated SEND_ON_BEHALF)
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SendOp {
    pub to: String,
    pub amount: String,
    pub token: String,
    pub external: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SignedBlock {
    pub operations: Vec<SendOp>,
    pub signature: String,
    pub signer: String,
}

#[derive(Clone)]
pub struct KeetaRpc {
    pub url: String,
}

impl KeetaRpc {
    pub fn new(url: &str) -> Self { Self { url: url.to_string() } }

    pub async fn send_on_behalf(&self, _storage_account: &str, _op: &SendOp) -> anyhow::Result<String> {
        // TODO: build ASN.1 block, sign with operator key (has SEND_ON_BEHALF), submit
        Ok(format!("DUMMY_TX_{}", rand_id()))
    }
}

fn rand_id() -> String { format!("{:x}", rand::random::<u64>()) }
```

---

## src/settlement.rs (withdrawal queue + worker)
```rust
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender, UnboundedReceiver};
use crate::models::WithdrawRequest;
use crate::keeta::{KeetaRpc, SendOp};

#[derive(Clone)]
pub struct Settlement {
    pub tx: UnboundedSender<WithdrawRequest>,
}

pub fn start_settlement_worker(rpc: KeetaRpc) -> Settlement {
    let (tx, mut rx) = unbounded_channel::<WithdrawRequest>();

    tokio::spawn(async move {
        while let Some(req) = rx.recv().await {
            let op = SendOp { to: req.to, amount: req.amount, token: req.token, external: None };
            // storage account lookup would be per-user; omitted for demo
            let _txid = rpc.send_on_behalf("S_user_PLACEHOLDER", &op).await;
            // TODO: persist status
        }
    });

    Settlement { tx }
}
```

---

## src/reconcile.rs (stub)
```rust
use crate::ledger::Ledger;

pub async fn run_reconciliation(_ledger: Ledger) {
    // TODO:
    // - fetch chain balances for each S_user
    // - compare against internal ledger totals
    // - raise alerts on drift
}
```

---

## src/api.rs (Actix routes)
```rust
use actix_web::{get, post, web, HttpResponse};
use serde::Deserialize;
use uuid::Uuid;
use crate::models::*;
use crate::engine::{Engine, EngineCmd};
use crate::ledger::Ledger;
use crate::settlement::Settlement;

#[derive(Clone)]
pub struct AppState {
    pub engine: Engine,
    pub ledger: Ledger,
    pub settlement: Settlement,
}

#[post("/auth/challenge")]
pub async fn auth_challenge() -> HttpResponse {
    let nonce = Uuid::new_v4().to_string();
    HttpResponse::Ok().json(AuthChallenge { nonce })
}

#[derive(Deserialize)]
pub struct VerifyBody { pub pubkey: String, pub signature: String }

#[post("/auth/verify")]
pub async fn auth_verify(body: web::Json<VerifyBody>) -> HttpResponse {
    // TODO: verify signature; issue JWT
    HttpResponse::Ok().json(AuthSession { user_id: body.pubkey.clone(), jwt: "DUMMY".into() })
}

#[get("/balances")]
pub async fn balances(state: web::Data<AppState>) -> HttpResponse {
    // Use JWT -> user_id; demo uses fixed user
    let user = "demo-user";
    HttpResponse::Ok().json(state.ledger.list_balances(user))
}

#[post("/orders/place")]
pub async fn place_order(state: web::Data<AppState>, body: web::Json<LimitOrder>) -> HttpResponse {
    let (tx, rx) = tokio::sync::oneshot::channel();
    let _ = state.engine.tx_cmd.send(EngineCmd::Place { user_id: "demo-user".into(), order: body.into_inner(), resp: tx });
    let placed = rx.await.unwrap();
    HttpResponse::Ok().json(placed)
}

#[post("/orders/cancel")]
pub async fn cancel_order(_state: web::Data<AppState>, body: web::Json<CancelOrderRequest>) -> HttpResponse {
    // TODO: implement cancellation
    HttpResponse::Ok().json(serde_json::json!({ "id": body.id.clone(), "status": "canceled" }))
}

#[get("/deposits/address")]
pub async fn deposit_address() -> HttpResponse {
    // Return user's S_user address; demo constant
    HttpResponse::Ok().json(DepositAddress { storage_account: "S_DEMO_USER" .into() })
}

#[post("/withdrawals/request")]
pub async fn withdrawals(state: web::Data<AppState>, body: web::Json<WithdrawRequest>) -> HttpResponse {
    let req = body.into_inner();
    let _ = state.settlement.tx.send(req.clone());
    HttpResponse::Ok().json(WithdrawEnqueued { request_id: Uuid::new_v4().to_string() })
}
```

---

## src/main.rs
```rust
mod models;
mod ledger;
mod engine;
mod keeta;
mod settlement;
mod reconcile;
mod api;

use actix_web::{App, HttpServer, web};
use crate::ledger::Ledger;
use crate::engine::start_engine;
use crate::keeta::KeetaRpc;
use crate::settlement::start_settlement_worker;
use crate::api::{AppState, auth_challenge, auth_verify, balances, place_order, cancel_order, deposit_address, withdrawals};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();

    // state
    let ledger = Ledger::new();
    // seed demo balances
    ledger.credit("demo-user", "USDT", 10000.0);
    ledger.credit("demo-user", "USDX", 1000.0);

    let engine = start_engine(ledger.clone());
    let rpc = KeetaRpc::new("http://localhost:9090");
    let settlement = start_settlement_worker(rpc);

    let state = api::AppState { engine, ledger: ledger.clone(), settlement };

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .service(auth_challenge)
            .service(auth_verify)
            .service(balances)
            .service(place_order)
            .service(cancel_order)
            .service(deposit_address)
            .service(withdrawals)
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}
```
