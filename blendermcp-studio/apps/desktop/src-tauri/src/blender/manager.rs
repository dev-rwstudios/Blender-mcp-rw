use crate::blender::protocol::{BlenderRequest, BlenderResponse};
use dashmap::DashMap;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct BlenderSession {
    pub id: String,
    pub port: u16,
    pub label: String,
    stream: Arc<Mutex<TcpStream>>,
}

pub struct BlenderManager {
    sessions: DashMap<String, BlenderSession>,
}

impl BlenderManager {
    pub fn new() -> Self {
        Self {
            sessions: DashMap::new(),
        }
    }

    pub async fn connect(&self, port: u16, label: String) -> Result<String, String> {
        let addr = format!("127.0.0.1:{}", port);
        let stream = TcpStream::connect(&addr)
            .await
            .map_err(|e| format!("TCP connect failed: {}", e))?;

        let id = uuid::Uuid::new_v4().to_string();
        let session = BlenderSession {
            id: id.clone(),
            port,
            label,
            stream: Arc::new(Mutex::new(stream)),
        };

        self.send_command_to_session(&session, "get_scene_info", serde_json::json!({}))
            .await
            .map_err(|e| format!("Health check failed: {}", e))?;

        self.sessions.insert(id.clone(), session);
        Ok(id)
    }

    pub async fn disconnect(&self, session_id: &str) {
        self.sessions.remove(session_id);
    }

    pub async fn send_command(
        &self,
        session_id: &str,
        command: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| "Session not found".to_string())?;

        self.send_command_to_session(&session, command, params).await
    }

    async fn send_command_to_session(
        &self,
        session: &BlenderSession,
        command: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let request = BlenderRequest {
            cmd_type: command.to_string(),
            params,
        };
        let payload = serde_json::to_vec(&request).map_err(|e| e.to_string())?;

        let mut stream = session.stream.lock().await;

        stream
            .write_all(&payload)
            .await
            .map_err(|e| format!("Write failed: {}", e))?;
        stream
            .write_all(b"\n")
            .await
            .map_err(|e| format!("Write newline failed: {}", e))?;

        let mut buf = Vec::with_capacity(65536);
        let mut tmp = [0u8; 8192];
        loop {
            let n = stream
                .read(&mut tmp)
                .await
                .map_err(|e| format!("Read failed: {}", e))?;
            if n == 0 {
                break;
            }
            buf.extend_from_slice(&tmp[..n]);
            if serde_json::from_slice::<BlenderResponse>(&buf).is_ok() {
                break;
            }
        }

        let resp: BlenderResponse =
            serde_json::from_slice(&buf).map_err(|e| format!("Parse failed: {}", e))?;

        if resp.status == "success" {
            Ok(resp.result.unwrap_or(serde_json::Value::Null))
        } else {
            Err(resp.message.unwrap_or_else(|| "Unknown error".to_string()))
        }
    }

    pub fn list_sessions(&self) -> Vec<(String, u16, String)> {
        self.sessions
            .iter()
            .map(|e| (e.id.clone(), e.port, e.label.clone()))
            .collect()
    }
}
