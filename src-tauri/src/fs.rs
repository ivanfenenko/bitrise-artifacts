use crate::commands::Settings;
use serde_json;
use std::path::PathBuf;

fn get_config_dir() -> anyhow::Result<PathBuf> {
    let home = dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not get home directory"))?;
    let config_dir = home.join(".bitrise-artifacts");
    std::fs::create_dir_all(&config_dir)?;
    Ok(config_dir)
}

pub fn get_cache_dir() -> anyhow::Result<PathBuf> {
    let config_dir = get_config_dir()?;
    let cache_dir = config_dir.join("cache");
    std::fs::create_dir_all(&cache_dir)?;
    Ok(cache_dir)
}

pub async fn save_settings(settings: &Settings) -> anyhow::Result<()> {
    let config_dir = get_config_dir()?;
    let settings_path = config_dir.join("settings.json");
    
    let json = serde_json::to_string_pretty(settings)?;
    tokio::fs::write(settings_path, json).await?;
    
    Ok(())
}

pub async fn load_settings() -> anyhow::Result<Settings> {
    let config_dir = get_config_dir()?;
    let settings_path = config_dir.join("settings.json");
    
    if !settings_path.exists() {
        return Ok(Settings {
            api_token: String::new(),
            selected_app_slug: None,
            watchlist_apps: Vec::new(),
            watchlist_branches: std::collections::HashMap::new(),
            downloaded_artifacts: std::collections::HashMap::new(),
        });
    }
    
    let content = tokio::fs::read_to_string(settings_path).await?;
    let settings: Settings = serde_json::from_str(&content)?;
    
    Ok(settings)
}

pub async fn clear_cache() -> anyhow::Result<()> {
    let cache_dir = get_cache_dir()?;
    
    if cache_dir.exists() {
        tokio::fs::remove_dir_all(&cache_dir).await?;
        // Recreate the cache directory
        tokio::fs::create_dir_all(&cache_dir).await?;
    }
    
    Ok(())
}

pub async fn clear_all_data() -> anyhow::Result<()> {
    let config_dir = get_config_dir()?;
    
    if config_dir.exists() {
        tokio::fs::remove_dir_all(&config_dir).await?;
    }
    
    Ok(())
}
