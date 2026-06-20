use std::collections::HashMap;
use tauri::Manager;

fn keys_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .expect("no app data dir")
        .join("api_keys.json")
}

fn load_keys(app: &tauri::AppHandle) -> HashMap<String, String> {
    let path = keys_path(app);
    if let Ok(data) = std::fs::read_to_string(&path) {
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        HashMap::new()
    }
}

fn save_keys(app: &tauri::AppHandle, keys: &HashMap<String, String>) -> Result<(), String> {
    let path = keys_path(app);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_string(keys).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn settings_save_key(
    app: tauri::AppHandle,
    provider: String,
    key: String,
) -> Result<(), String> {
    let mut keys = load_keys(&app);
    keys.insert(provider, key);
    save_keys(&app, &keys)
}

#[tauri::command]
pub async fn settings_get_key(
    app: tauri::AppHandle,
    provider: String,
) -> Result<Option<String>, String> {
    let keys = load_keys(&app);
    Ok(keys.get(&provider).cloned())
}
