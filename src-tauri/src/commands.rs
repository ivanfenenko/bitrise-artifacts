use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::bitrise::{self, BitriseClient};
use crate::adb;
use crate::fs;

pub struct AppState {
    pub bitrise_client: Arc<Mutex<Option<BitriseClient>>>,
}

#[derive(Serialize, Deserialize)]
pub struct Settings {
    pub api_token: String,
    pub selected_app_slug: Option<String>,
}

#[tauri::command]
pub async fn get_apps(
    token: String,
    state: State<'_, AppState>,
) -> Result<Vec<bitrise::App>, String> {
    let client = BitriseClient::new(token);
    let apps = client.get_apps().await.map_err(|e: anyhow::Error| e.to_string())?;
    
    let mut guard = state.bitrise_client.lock().await;
    *guard = Some(client);
    
    Ok(apps)
}

#[tauri::command]
pub async fn get_builds(
    appSlug: String,
    state: State<'_, AppState>,
) -> Result<Vec<bitrise::Build>, String> {
    let guard = state.bitrise_client.lock().await;
    let client = guard.as_ref().ok_or("Bitrise client not initialized")?;
    
    match client.get_builds(&appSlug).await {
        Ok(builds) => Ok(builds),
        Err(e) => {
            eprintln!("Error fetching builds: {:?}", e);
            Err(format!("Failed to fetch builds: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_artifacts(
    appSlug: String,
    buildSlug: String,
    state: State<'_, AppState>,
) -> Result<Vec<bitrise::Artifact>, String> {
    let guard = state.bitrise_client.lock().await;
    let client = guard.as_ref().ok_or("Bitrise client not initialized")?;
    
    client.get_artifacts(&appSlug, &buildSlug).await.map_err(|e: anyhow::Error| e.to_string())
}

#[tauri::command]
pub async fn download_artifact(
    appSlug: String,
    buildSlug: String,
    artifactSlug: String,
    fileName: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let guard = state.bitrise_client.lock().await;
    let client = guard.as_ref().ok_or("Bitrise client not initialized")?;
    
    let save_path = client.download_artifact(&appSlug, &buildSlug, &artifactSlug, &fileName)
        .await
        .map_err(|e: anyhow::Error| e.to_string())?;
    
    Ok(save_path)
}

#[tauri::command]
pub async fn get_connected_devices() -> Result<Vec<adb::Device>, String> {
    adb::get_devices().await.map_err(|e: anyhow::Error| e.to_string())
}

#[tauri::command]
pub async fn install_apk(
    apkPath: String,
    deviceId: Option<String>,
) -> Result<String, String> {
    adb::install_apk(&apkPath, deviceId.as_deref())
        .await
        .map_err(|e: anyhow::Error| e.to_string())
}

#[tauri::command]
pub async fn save_settings(settings: Settings) -> Result<(), String> {
    fs::save_settings(&settings).await.map_err(|e: anyhow::Error| e.to_string())
}

#[tauri::command]
pub async fn load_settings() -> Result<Settings, String> {
    fs::load_settings().await.map_err(|e: anyhow::Error| e.to_string())
}