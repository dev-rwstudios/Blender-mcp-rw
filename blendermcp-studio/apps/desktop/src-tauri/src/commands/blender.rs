use crate::blender::manager::BlenderManager;
use std::sync::Arc;
use tauri::State;

type BM<'a> = State<'a, Arc<BlenderManager>>;

#[tauri::command]
pub async fn blender_connect(manager: BM<'_>, port: u16, label: String) -> Result<String, String> {
    manager.connect(port, label).await
}

#[tauri::command]
pub async fn blender_disconnect(
    manager: BM<'_>,
    session_id: String,
) -> Result<(), String> {
    manager.disconnect(&session_id).await;
    Ok(())
}

#[tauri::command]
pub async fn blender_send_command(
    manager: BM<'_>,
    session_id: String,
    command: String,
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    manager.send_command(&session_id, &command, params).await
}

#[tauri::command]
pub async fn blender_list_sessions(manager: BM<'_>) -> Result<Vec<serde_json::Value>, String> {
    Ok(manager
        .list_sessions()
        .into_iter()
        .map(|(id, port, label)| {
            serde_json::json!({ "id": id, "port": port, "label": label })
        })
        .collect())
}
