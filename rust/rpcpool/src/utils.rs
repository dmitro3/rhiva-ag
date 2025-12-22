use hyper::http::header::{HeaderMap, HeaderName, HeaderValue};

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

pub struct RedisOptions {
    pub _master_name: String,
    pub _password: String,
    pub _port: u16,
    pub _host: String,
}

pub fn get_redis_client(_options: Option<RedisOptions>) -> redis::RedisResult<redis::Client> {
    let name = std::env::var("APP_REDIS_MASTER_NAME").ok();
    let port = std::env::var("APP_REDIS_SENTINEL_PORT").ok();
    let host = std::env::var("APP_REDIS_SENTINEL_HOSTNAME").ok();
    let password = std::env::var("APP_REDIS_PASSWORD").ok();

    let client = if let (Some(name), Some(host), Some(port)) = (name, host, port) {
        let mut url = format!("redis-sentinel://{}:{}?master_name={}", host, port, name);

        if let Some(password) = password {
            url = format!("{}&{}", url, password);
        }

        redis::Client::open(url.as_str())?
    } else {
        let redis_url = std::env::var("REDIS_URL").expect("REDIS_URL is required in .env file");
        redis::Client::open(redis_url.as_str())?
    };

    Ok(client)
}
