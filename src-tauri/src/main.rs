// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bitrise;
mod commands;
mod adb;
mod fs;

use commands::AppState;
use std::sync::Arc;
use tokio::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            bitrise_client: Arc::new(Mutex::new(None)),
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_apps,
            commands::get_builds,
            commands::get_artifacts,
            commands::download_artifact,
            commands::get_connected_devices,
            commands::install_apk,
            commands::save_to_downloads,
            commands::open_path,
            commands::save_settings,
            commands::load_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
