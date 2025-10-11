use actix::{Actor, ActorContext, AsyncContext, StreamHandler};
use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Serialize, Deserialize)]
struct SubscribeMessage {
    #[serde(rename = "type")]
    msg_type: String,
    channels: Vec<String>,
}

#[derive(Debug, Serialize)]
struct WsMessage {
    #[serde(rename = "type")]
    msg_type: String,
    data: serde_json::Value,
}

pub struct TradingWebSocket {
    hb: Instant,
    subscribed_channels: Vec<String>,
}

impl TradingWebSocket {
    pub fn new() -> Self {
        Self {
            hb: Instant::now(),
            subscribed_channels: Vec::new(),
        }
    }

    fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                warn!("WebSocket client heartbeat failed, disconnecting");
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }

    fn send_mock_orderbook(&self, ctx: &mut ws::WebsocketContext<Self>, market: &str) {
        let orderbook = serde_json::json!({
            "bids": [
                ["0.0892", "558.5"],
                ["0.08915", "1234.5"],
                ["0.0891", "2345.6"],
                ["0.08905", "3456.7"],
                ["0.089", "4567.8"],
            ],
            "asks": [
                ["0.08925", "211"],
                ["0.0893", "1234.5"],
                ["0.08935", "2345.6"],
                ["0.0894", "3456.7"],
                ["0.08945", "4567.8"],
            ]
        });

        let msg = WsMessage {
            msg_type: "orderbook".to_string(),
            data: orderbook,
        };

        if let Ok(json) = serde_json::to_string(&msg) {
            ctx.text(json);
            info!("Sent mock orderbook for market: {}", market);
        }
    }

    fn send_mock_trade(&self, ctx: &mut ws::WebsocketContext<Self>, market: &str) {
        let trade = serde_json::json!({
            "id": format!("trade-{}", uuid::Uuid::new_v4()),
            "market": market,
            "price": "0.089",
            "quantity": "500",
            "side": "buy",
            "timestamp": chrono::Utc::now().timestamp_millis()
        });

        let msg = WsMessage {
            msg_type: "trade".to_string(),
            data: trade,
        };

        if let Ok(json) = serde_json::to_string(&msg) {
            ctx.text(json);
            info!("Sent mock trade for market: {}", market);
        }
    }
}

impl Actor for TradingWebSocket {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        info!("WebSocket connection established");
        self.hb(ctx);
    }

    fn stopped(&mut self, _: &mut Self::Context) {
        info!("WebSocket connection closed");
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for TradingWebSocket {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => {
                self.hb = Instant::now();
                ctx.pong(&msg);
            }
            Ok(ws::Message::Pong(_)) => {
                self.hb = Instant::now();
            }
            Ok(ws::Message::Text(text)) => {
                info!("Received message: {}", text);

                if let Ok(subscribe_msg) = serde_json::from_str::<SubscribeMessage>(&text) {
                    if subscribe_msg.msg_type == "subscribe" {
                        self.subscribed_channels = subscribe_msg.channels.clone();
                        info!(
                            "Client subscribed to channels: {:?}",
                            self.subscribed_channels
                        );

                        // Send initial data for each subscribed channel
                        for channel in &self.subscribed_channels {
                            if let Some(market) = channel.strip_prefix("orderbook:") {
                                self.send_mock_orderbook(ctx, market);
                            } else if let Some(market) = channel.strip_prefix("trades:") {
                                self.send_mock_trade(ctx, market);
                            }
                        }

                        // Send acknowledgment
                        let ack = serde_json::json!({
                            "type": "subscribed",
                            "channels": self.subscribed_channels
                        });
                        if let Ok(json) = serde_json::to_string(&ack) {
                            ctx.text(json);
                        }
                    }
                }
            }
            Ok(ws::Message::Binary(_)) => {
                warn!("Binary messages not supported");
            }
            Ok(ws::Message::Close(reason)) => {
                info!("Client closed connection: {:?}", reason);
                ctx.stop();
            }
            _ => ctx.stop(),
        }
    }
}

pub async fn ws_trade(req: HttpRequest, stream: web::Payload) -> Result<HttpResponse, Error> {
    info!(
        "New WebSocket connection request from {:?}",
        req.peer_addr()
    );
    let resp = ws::start(TradingWebSocket::new(), &req, stream)?;
    Ok(resp)
}
