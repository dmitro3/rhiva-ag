use dotenv::dotenv;
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use axum::{
    Router,
    body::Body,
    extract::{Request, State},
    response::Response,
    routing::any,
};

use crate::{proxy::SolanaRpcProxy, utils::get_redis_client};

mod proxy;
mod rpc;
mod types;
mod utils;

async fn proxy_handler(
    State(proxy): State<Arc<SolanaRpcProxy>>,
    request: Request<Body>,
) -> Response<Body> {
    proxy.on_request(request).await
}

#[tokio::main]
#[cfg(not(feature = "seed"))]
async fn main() {
    dotenv().ok();
    let redis = get_redis_client(None).expect("can't open redis connection");

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();
    let proxy = Arc::new(SolanaRpcProxy::new(redis));
    let app = Router::new()
        .route("/", any(proxy_handler))
        .with_state(proxy)
        .layer(tower_http::trace::TraceLayer::new_for_http());
    let addr = "0.0.0.0:8000";
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bund to this address");
    println!("rpcpool proxy server listening on {}", addr);
    axum::serve(listener, app)
        .await
        .expect("rpcpool proxy server failed to start");
}

#[tokio::main]
#[cfg(feature = "seed")]
async fn main() -> redis::RedisResult<()> {
    use crate::{
        rpc::{RpcHealth, RpcProvider, RpcSupport},
        utils::get_redis_client,
    };

    dotenv().ok();
    let redis = get_redis_client(None).expect("can't open redis connection");
    let providers = vec![
        RpcProvider::new(
            "helius",
            "https://mainnet.helius-rpc.com/?api-key=a7ed64b4-6375-46cc-963f-684edbddb17c",
            None,
            10.0,
            Some(50),
            RpcHealth::new(0, 0, 0, 0, 0),
            vec![RpcSupport::Default],
        ),
        RpcProvider::new(
            "drpc",
            "https://lb.drpc.live/solana/AjYxjROkIkIxpk0CFmpujWmldOO-nKoR8L87wg8TMB_n",
            None,
            5.0,
            None,
            RpcHealth::new(0, 0, 0, 0, 0),
            vec![RpcSupport::Default],
        ),
    ];

    RpcProvider::save_all(&redis, &providers)
}
