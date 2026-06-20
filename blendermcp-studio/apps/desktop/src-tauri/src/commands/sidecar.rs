use crate::sidecar::manager::SidecarManager;
use std::sync::Arc;
use tauri::State;

type SM<'a> = State<'a, Arc<SidecarManager>>;

#[tauri::command]
pub async fn sidecar_start(
    manager: SM<'_>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    manager.start(&app_handle).await
}

#[tauri::command]
pub async fn sidecar_stop(manager: SM<'_>) -> Result<(), String> {
    manager.stop();
    Ok(())
}

#[tauri::command]
pub async fn sidecar_status(manager: SM<'_>) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "running": manager.is_running() }))
}
