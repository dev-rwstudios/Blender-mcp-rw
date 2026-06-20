use std::sync::atomic::{AtomicBool, Ordering};
use tauri_plugin_shell::ShellExt;

pub struct SidecarManager {
    running: AtomicBool,
}

impl SidecarManager {
    pub fn new() -> Self {
        Self {
            running: AtomicBool::new(false),
        }
    }

    pub async fn start(&self, app_handle: &tauri::AppHandle) -> Result<(), String> {
        if self.running.load(Ordering::SeqCst) {
            return Ok(());
        }
        let sidecar = app_handle
            .shell()
            .sidecar("sidecar")
            .map_err(|e| e.to_string())?;

        let (_rx, _child) = sidecar.spawn().map_err(|e| e.to_string())?;

        self.running.store(true, Ordering::SeqCst);
        Ok(())
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}
