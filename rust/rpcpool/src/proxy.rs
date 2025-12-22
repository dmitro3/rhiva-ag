use std::usize;

use log::{ error};
use serde_json::json;

use crate::{
    rpc::{RpcPool, RpcProvider},
    types::HandlerResult,
    utils::{RedisClientFactory, clean_headers},
};

pub struct SolanaRpcProxy {
    redis: RedisClientFactory,
}

impl SolanaRpcProxy {
    pub fn new(redis: RedisClientFactory) -> Self {
        Self { redis }
    }

    async fn handle_request(
        &self,
        request: axum::http::Request<axum::body::Body>,
    ) -> HandlerResult {
        let client = reqwest::Client::new();
        let redis = (self.redis)().map_err(|error| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                axum::Error::new(error),
            )
        })?;
        let providers = RpcProvider::load_all(&redis).map_err(|error| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                axum::Error::new(error),
            )
        })?;

        let rpc_pool = RpcPool::new(&providers);
        let (parts, body) = request.into_parts();

        let request_headers = clean_headers(&parts.headers, &["host"]);

        let body_bytes = axum::body::to_bytes(body, usize::MAX)
            .await
            .map_err(|error| (axum::http::StatusCode::BAD_GATEWAY, axum::Error::new(error)))?;
        let method = reqwest::Method::from_bytes(parts.method.as_str().as_bytes())
            .map_err(|error| (axum::http::StatusCode::BAD_GATEWAY, axum::Error::new(error)))?;
        let response = rpc_pool
            .send_request(&redis, &client, method, body_bytes, &request_headers)
            .await
            .map_err(|error| {
                (
                    axum::http::StatusCode::BAD_GATEWAY,
                    axum::Error::new(error.unwrap()),
                )
            })?;
        let status = response.status();
        let headers = response.headers().clone();
        let body_bytes = response
            .bytes()
            .await
            .map_err(|error| (axum::http::StatusCode::BAD_GATEWAY, axum::Error::new(error)))?;
        let mut response = axum::http::Response::builder()
            .header("content-type", "application/json")
            .status(status)
            .body(axum::body::Body::from(body_bytes))
            .unwrap();
        *response.headers_mut() = clean_headers(&headers, &["host", "content-length", "transfer-encoding"]);
        Ok(response)
    }

    pub async fn on_request(
        &self,
        request: axum::http::Request<axum::body::Body>,
    ) -> axum::http::Response<axum::body::Body> {
        match self.handle_request(request).await {
            Ok(response) => response,
            Err((status, message)) => {
                error!("Request failed: {} - {}", status, message);
                let error_body = json!({
                  "status": status.as_u16(),
                  "error": message.to_string(),
                });

                axum::http::Response::builder()
                    .status(status)
                    .header(
                        axum::http::HeaderName::from_static("content-type"),
                        axum::http::HeaderValue::from_static("application/json"),
                    )
                    .body(axum::body::Body::from(error_body.to_string()))
                    .unwrap_or_else(|_| {
                        axum::http::Response::new(axum::body::Body::from("Internal Server Error"))
                    })
            }
        }
    }
}
