mod blender;
mod commands;
mod db;
mod sidecar;

use blender::manager::BlenderManager;
use sidecar::manager::SidecarManager;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let blender_manager = Arc::new(BlenderManager::new());
    let sidecar_manager = Arc::new(SidecarManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:blendermcp.db", db::get_migrations())
                .build(),
        )
        .plugin(tauri_plugin_stronghold::Builder::new(|_| vec![]).build())
        .plugin(tauri_plugin_log::Builder::default().build())
        .manage(blender_manager)
        .manage(sidecar_manager)
        .invoke_handler(tauri::generate_handler![
            commands::blender::blender_connect,
            commands::blender::blender_disconnect,
            commands::blender::blender_send_command,
            commands::blender::blender_list_sessions,
            commands::sidecar::sidecar_start,
            commands::sidecar::sidecar_stop,
            commands::sidecar::sidecar_status,
            commands::settings::settings_save_key,
            commands::settings::settings_get_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
