use redis::Commands;
use serde::{Deserialize, Serialize};
use tracing::warn;

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug)]
pub enum RpcSupport {
    Heavy,
    Light,
    Ws,
    Default,
}

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug)]
pub struct RpcHealth {
    pub latency_ms: u128,
    pub last_request: u32,
    pub request_count: u8,
    pub last_updated: i64,
    pub consective_error: u8,
}

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug)]
pub struct RpcProvider {
    pub name: String,
    pub weight: f64,
    pub http_url: String,
    pub max_rps: Option<u8>,
    pub ws_url: Option<String>,
    pub health: RpcHealth,
    pub supports: Vec<RpcSupport>,
}

pub struct RpcPool<'a> {
    rpc_providers: &'a [RpcProvider],
}

impl RpcHealth {
    #[allow(dead_code)]
    pub fn new(
        latency_ms: u128,
        last_request: u32,
        request_count: u8,
        last_updated: i64,
        consective_error: u8,
    ) -> Self {
        Self {
            latency_ms,
            last_request,
            request_count,
            last_updated,
            consective_error,
        }
    }
}

impl RpcProvider {
    const RPC_PROVIDER_KEY: &str = "rpc:provider";

    #[allow(dead_code)]
    pub fn new(
        name: impl Into<String>,
        http_url: impl Into<String>,
        ws_url: Option<String>,
        weight: f64,
        max_rps: Option<u8>,
        health: RpcHealth,
        supports: Vec<RpcSupport>,
    ) -> RpcProvider {
        Self {
            weight,
            ws_url,
            max_rps,
            health,
            supports,
            name: name.into(),
            http_url: http_url.into(),
        }
    }

    /// request_count get reset every seconds, make sense if we have a hard kill switch for provider xceeding the max rate limit.
    /// latency_ms get reset on every request
    /// consecutive_error get reset everytime a provider has a success request
    fn score(&self, latency_target: u16) -> f64 {
        if let Some(max_rps) = self.max_rps {
            if self.health.request_count >= max_rps {
                return 0.0;
            }
        }
        let error_rate = (-1_f64 * (self.health.consective_error) as f64).exp();
        let latency_rate =
            (-0.4_f64 * ((self.health.latency_ms) as f64 / (latency_target) as f64)).exp();

        return error_rate * latency_rate;
    }

    #[allow(dead_code)]
    pub fn supports(&self, value: RpcSupport) -> bool {
        self.supports.contains(&value)
    }

    #[allow(dead_code)]
    pub fn load(redis: &redis::Client, name: &str) -> redis::RedisResult<Option<Self>> {
        let mut connection = redis.get_connection()?;
        let value: Option<String> = connection.hget(Self::RPC_PROVIDER_KEY, name)?;
        match value {
            Some(value) => {
                let provider: Self = serde_json::from_str(&value).map_err(|err| {
                    redis::RedisError::from((
                        redis::ErrorKind::Parse,
                        "Deserialization error",
                        err.to_string(),
                    ))
                })?;
                Ok(Some(provider))
            }
            None => Ok(None),
        }
    }

    pub fn load_all(redis: &redis::Client) -> redis::RedisResult<Vec<Self>> {
        let mut connection = redis.get_connection()?;
        let results: std::collections::HashMap<String, String> =
            connection.hgetall(Self::RPC_PROVIDER_KEY)?;
        let mut providers = Vec::new();
        for (_name, json) in results {
            let provider: Self = serde_json::from_str(&json).map_err(|err| {
                redis::RedisError::from((
                    redis::ErrorKind::Parse,
                    "Deserialization error",
                    err.to_string(),
                ))
            })?;

            providers.push(provider);
        }
        Ok(providers)
    }

    pub fn save(&self, redis: &redis::Client) -> redis::RedisResult<()> {
        let mut connection = redis.get_connection()?;
        let value = serde_json::to_string(self).map_err(|err| {
            redis::RedisError::from((
                redis::ErrorKind::Parse,
                "Serialization error",
                err.to_string(),
            ))
        })?;

        connection.hset::<_, _, _, ()>(Self::RPC_PROVIDER_KEY, &self.name, &value)?;

        Ok(())
    }

    #[allow(dead_code)]
    pub fn save_all(redis: &redis::Client, providers: &[Self]) -> redis::RedisResult<()> {
        let mut connection = redis.get_connection()?;
        let values = providers
            .iter()
            .map(|provider| {
                (
                    &provider.name,
                    serde_json::to_string(provider)
                        .map_err(|err| {
                            redis::RedisError::from((
                                redis::ErrorKind::Parse,
                                "Serialization error",
                                err.to_string(),
                            ))
                        })
                        .unwrap(),
                )
            })
            .collect::<Vec<(&String, String)>>();

        connection.hset_multiple::<_, _, _, ()>(Self::RPC_PROVIDER_KEY, &values)?;

        Ok(())
    }
}

impl<'a> RpcPool<'a> {
    const WHITELISTED_STATUS: &'static [reqwest::StatusCode] = &[
        reqwest::StatusCode::UNAUTHORIZED,
        reqwest::StatusCode::GATEWAY_TIMEOUT,
        reqwest::StatusCode::REQUEST_TIMEOUT,
        reqwest::StatusCode::TOO_MANY_REQUESTS,
        reqwest::StatusCode::INTERNAL_SERVER_ERROR,
        reqwest::StatusCode::PROXY_AUTHENTICATION_REQUIRED,
        reqwest::StatusCode::NON_AUTHORITATIVE_INFORMATION,
        reqwest::StatusCode::NETWORK_AUTHENTICATION_REQUIRED,
    ];

    pub fn new(rpc_providers: &'a [RpcProvider]) -> Self {
        Self { rpc_providers }
    }

    pub async fn send_request(
        &self,
        redis: &redis::Client,
        client: &reqwest::Client,
        method: reqwest::Method,
        body: bytes::Bytes,
        headers: &reqwest::header::HeaderMap,
    ) -> Result<reqwest::Response, Option<reqwest::Error>> {
        let mut providers = self.rpc_providers.iter().collect::<Vec<&RpcProvider>>();
        providers.sort_by(|a, b| {
            let latency_target = 500_u16;
            let score_a = a.score(latency_target);
            let score_b = b.score(latency_target);
            (b.weight * score_a)
                .partial_cmp(&(a.weight * score_b))
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let mut last_error: Option<reqwest::Error> = None;
        if providers.len() == 0 {
            panic!("no provider found");
        }

        for provider in providers {
            let mut provider = provider.clone();
            println!("provider={}", provider.http_url);
            let latency = std::time::Instant::now();
            let response = client
                .request(method.clone(), &provider.http_url)
                .body(body.clone())
                .headers(headers.clone())
                .send()
                .await;

            match response {
                Ok(response) => {
                    let status = response.status();
                    println!("status={:?} url={:?}", status, provider.http_url);

                    let latency = latency.elapsed();

                    let now = chrono::Utc::now().timestamp();
                    if now - provider.health.last_updated >= 1 {
                        provider.health.request_count = 0;
                    } else {
                        provider.health.request_count += 1;
                    }

                    if !status.is_success() {
                        provider.health.consective_error = 0;
                    } else {
                        provider.health.consective_error += 1;
                    }

                    provider.health.last_updated = now;
                    provider.health.latency_ms = latency.as_millis();

                    provider.save(redis).ok();

                    if Self::WHITELISTED_STATUS.contains(&status) {
                        warn!(
                            "provider={} url={} rpc request failed",
                            provider.name, provider.http_url
                        );
                        continue;
                    }

                    return Ok(response);
                }
                Err(error) => {
                    warn!(
                        "provider={} url={} rpc request error={}",
                        provider.name, provider.http_url, error
                    );
                    last_error = Some(error);
                    continue;
                }
            }
        }

        Err(last_error)
    }
}
