use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::bitrise::{self, BitriseClient};
use crate::adb;
use crate::fs;
use std::process::Command;

pub struct AppState {
    pub bitrise_client: Arc<Mutex<Option<BitriseClient>>>,
}

#[derive(Serialize, Deserialize)]
pub struct Settings {
    pub api_token: String,
    pub selected_app_slug: Option<String>,
    #[serde(default)]
    pub watchlist_apps: Vec<bitrise::App>,
    #[serde(default)]
    pub watchlist_branches: std::collections::HashMap<String, Vec<String>>,
    #[serde(default)]
    pub downloaded_artifacts: std::collections::HashMap<String, DownloadedArtifactInfo>,
}

#[derive(Serialize, Deserialize)]
pub struct DownloadedArtifactInfo {
    pub path: String,
    pub fileName: String,
    #[serde(default)]
    pub downloadPath: Option<String>,
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
pub async fn install_and_launch_apk(
    apkPath: String,
    deviceId: Option<String>,
) -> Result<String, String> {
    adb::install_and_launch_apk(&apkPath, deviceId.as_deref())
        .await
        .map_err(|e: anyhow::Error| e.to_string())
}

#[tauri::command]
pub async fn uninstall_apk(
    packageName: String,
    deviceId: Option<String>,
) -> Result<String, String> {
    adb::uninstall_apk(&packageName, deviceId.as_deref())
        .await
        .map_err(|e: anyhow::Error| e.to_string())
}

#[tauri::command]
pub async fn get_package_name(
    apkPath: String,
) -> Result<String, String> {
    adb::get_package_name(&apkPath)
        .map_err(|e: anyhow::Error| e.to_string())
}

#[tauri::command]
pub fn check_adb_available() -> bool {
    adb::check_adb_available()
}

#[tauri::command]
pub fn get_adb_location() -> Option<String> {
    adb::get_adb_location()
}

#[tauri::command]
pub async fn save_to_downloads(
    cachePath: String,
    fileName: String,
) -> Result<String, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Could not get home directory".to_string())?;
    let download_dir = home.join("Downloads").join("Bitrise");
    
    // Ensure Downloads/Bitrise directory exists
    tokio::fs::create_dir_all(&download_dir)
        .await
        .map_err(|e| format!("Failed to create Downloads directory: {}", e))?;
    
    let requested_path = download_dir.join(&fileName);
    let (base, ext) = match fileName.rsplit_once('.') {
        Some((b, e)) => (b.to_string(), Some(e.to_string())),
        None => (fileName.clone(), None),
    };
    let mut dest_path = requested_path.clone();
    let mut counter = 1;
    while dest_path.exists() {
        let candidate_name = if let Some(ref extension) = ext {
            format!("{} ({}).{}", base, counter, extension)
        } else {
            format!("{} ({})", base, counter)
        };
        dest_path = download_dir.join(candidate_name);
        counter += 1;
    }
    let dest_path_str = dest_path.to_string_lossy().to_string();
    
    // Copy file from cache to Downloads
    tokio::fs::copy(&cachePath, &dest_path)
        .await
        .map_err(|e| format!("Failed to copy file to Downloads: {}", e))?;
    
    Ok(dest_path_str)
}

#[tauri::command]
pub async fn open_path(path: String) -> Result<(), String> {
    let is_url = path.starts_with("http://")
        || path.starts_with("https://")
        || path.starts_with("mailto:")
        || path.starts_with("tel:")
        || path.starts_with("file://");

    if !is_url && !std::path::Path::new(&path).exists() {
        return Err("File not found".to_string());
    }

    #[cfg(target_os = "macos")]
    let mut cmd = {
        let mut command = Command::new("open");
        command.arg(&path);
        command
    };

    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "", &path]);
        command
    };

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let mut cmd = {
        let mut command = Command::new("xdg-open");
        command.arg(&path);
        command
    };

    let status = cmd.status().map_err(|e| format!("Failed to open path: {}", e))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("Failed to open path (exit code: {:?})", status.code()))
    }
}

#[tauri::command]
pub async fn save_settings(settings: Settings) -> Result<(), String> {
    fs::save_settings(&settings).await.map_err(|e: anyhow::Error| e.to_string())
}

#[tauri::command]
pub async fn load_settings() -> Result<Settings, String> {
    fs::load_settings().await.map_err(|e: anyhow::Error| e.to_string())
}

#[tauri::command]
pub async fn clear_cache() -> Result<(), String> {
    fs::clear_cache().await.map_err(|e: anyhow::Error| e.to_string())
}

#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    // Clear the Bitrise client
    let mut guard = state.bitrise_client.lock().await;
    *guard = None;
    
    // Clear all data (settings, cache, etc.)
    fs::clear_all_data().await.map_err(|e: anyhow::Error| e.to_string())
}
