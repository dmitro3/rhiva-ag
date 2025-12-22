pub type HandlerResult =
    Result<axum::http::Response<axum::body::Body>, (axum::http::StatusCode, axum::Error)>;
