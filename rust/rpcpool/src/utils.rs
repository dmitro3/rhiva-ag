use std::sync::{Arc, Mutex};

use hyper::http::header::{HeaderMap, HeaderName, HeaderValue};
use redis::sentinel::SentinelNodeConnectionInfo;

const BLACKLIST_HEADERS: [&str; 3] = ["host", "content-length", "transfer-encoding"];

pub fn clean_headers<T>(headers: &T) -> HeaderMap
where
    T: IntoIterator<Item = (Option<HeaderName>, HeaderValue)> + Clone,
{
    let mut request_headers = HeaderMap::new();

    for (name_opt, value) in headers.clone() {
        if let Some(name) = name_opt {
            let lower_name = name.as_str().to_lowercase();
            if !BLACKLIST_HEADERS.contains(&lower_name.as_str()) {
                request_headers.append(name, value);
            }
        }
    }

    request_headers
}

pub struct SentinelRedisOption {
    pub master_name: String,
    pub port: String,
    pub host: String,
    pub password: Option<String>,
}

pub enum RedisOptions {
    Sentinel(SentinelRedisOption),
    Default(String),
}

pub type RedisClientFactory = Arc<dyn Fn() -> redis::RedisResult<redis::Client> + Send + Sync>;

impl RedisOptions {
    pub fn sentinel_config_from_env() -> Self {
        let password = std::env::var("APP_REDIS_PASSWORD").ok();
        let port = std::env::var("APP_REDIS_SENTINEL_PORT")
            .expect("APP_REDIS_SENTINEL_PORT is required in env");
        let host = std::env::var("APP_REDIS_SENTINEL_HOSTNAME")
            .expect("APP_REDIS_SENTINEL_HOSTNAME is required in env");
        let master_name = std::env::var("APP_REDIS_MASTER_NAME")
            .expect("APP_REDIS_SENTINEL_PORT is required in env");

        Self::Sentinel(SentinelRedisOption {
            port,
            host,
            master_name,
            password,
        })
    }

    pub fn redis_config_from_env() -> Self {
        let redis_url = std::env::var("REDIS_URL").expect("REDIS_URL is required in env");

        Self::Default(redis_url)
    }

    pub fn init(&self) -> redis::RedisResult<RedisClientFactory> {
        match self {
            Self::Default(redis_url) => {
                let redis_url = redis_url.clone();
                Ok(Arc::new(move || redis::Client::open(redis_url.as_str())))
            }
            Self::Sentinel(options) => {
                let mut nodes = vec![];
                let mut redis_connection_info = redis::RedisConnectionInfo::default();

                if let Some(password) = &options.password {
                    nodes.push(format!("redis://{}:{}", options.host, options.port));

                    redis_connection_info = redis_connection_info.set_password(password);
                } else {
                    nodes.push(format!("redis://{}:{}", options.host, options.port));
                }

                let sentinel_master_node_connection_info = SentinelNodeConnectionInfo::default()
                    .set_redis_connection_info(redis_connection_info);

                println!("nodes={:?}", nodes);
                let master_name = options.master_name.clone();
                let sentinel = redis::sentinel::SentinelClient::build(
                    nodes,
                    master_name,
                    Some(sentinel_master_node_connection_info),
                    redis::sentinel::SentinelServerType::Master,
                )?;

                let sentinel = Arc::new(Mutex::new(sentinel));

                Ok(Arc::new(move || {
                    let mut sentinel = sentinel.lock().expect("Sentinel mutex poisoned");
                    sentinel.get_client()
                }))
            }
        }
    }
}
