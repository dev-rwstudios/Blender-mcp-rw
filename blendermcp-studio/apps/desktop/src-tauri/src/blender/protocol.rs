use serde::{Deserialize, Serialize};

#[derive(Serialize, Debug)]
pub struct BlenderRequest {
    #[serde(rename = "type")]
    pub cmd_type: String,
    pub params: serde_json::Value,
}

#[derive(Deserialize, Debug)]
pub struct BlenderResponse {
    pub status: String,
    pub result: Option<serde_json::Value>,
    pub message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BlenderSessionInfo {
    pub id: String,
    pub port: u16,
    pub connected: bool,
    pub label: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SendCommandPayload {
    pub session_id: String,
    pub command: String,
    pub params: serde_json::Value,
}
