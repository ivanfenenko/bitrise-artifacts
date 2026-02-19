use reqwest::Client;
use serde::{Deserialize, Serialize};

const BITRISE_API_BASE: &str = "https://api.bitrise.io/v0.1";

#[derive(Debug, Clone)]
pub struct BitriseClient {
    client: Client,
    token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct App {
    pub slug: String,
    pub title: String,
    pub repo_slug: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Build {
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub build_number: Option<i64>,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub status_text: Option<String>,
    #[serde(default)]
    pub triggered_at: Option<String>,
    #[serde(default)]
    pub finished_at: Option<String>,
    #[serde(default)]
    pub triggered_by: Option<String>,
    #[serde(default)]
    pub commit_message: Option<String>,
    #[serde(default)]
    pub commit_hash: Option<String>,
    #[serde(default)]
    pub pull_request_id: Option<i64>,
    #[serde(default)]
    pub pull_request_target_branch: Option<String>,
    #[serde(default)]
    pub pull_request_author: Option<String>,
    #[serde(default)]
    pub pipeline_id: Option<String>,
    #[serde(default)]
    pub pipeline_workflow_id: Option<String>,
    #[serde(default, alias = "triggered_workflow")]
    pub workflow: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub artifact_type: Option<String>,
    #[serde(default)]
    pub file_size_bytes: Option<i64>,
    #[serde(default)]
    pub is_public_page_enabled: Option<bool>,
    #[serde(default)]
    pub public_install_page_url: Option<String>,
}

impl BitriseClient {
    pub fn new(token: String) -> Self {
        Self {
            client: Client::new(),
            token,
        }
    }

    pub async fn get_apps(&self) -> anyhow::Result<Vec<App>> {
        let url = format!("{}/apps", BITRISE_API_BASE);
        let response = self.client
            .get(&url)
            .header("Authorization", format!("token {}", self.token))
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("Failed to fetch apps: {}", response.status());
        }

        let data: serde_json::Value = response.json().await?;
        let apps: Vec<App> = serde_json::from_value(data["data"].clone())?;
        Ok(apps)
    }

    pub async fn get_builds(&self, app_slug: &str) -> anyhow::Result<Vec<Build>> {
        let url = format!("{}/apps/{}/builds?limit=50", BITRISE_API_BASE, app_slug);
        println!("Fetching builds from: {}", url);
        
        let response = self.client
            .get(&url)
            .header("Authorization", format!("token {}", self.token))
            .send()
            .await?;

        let status = response.status();
        println!("Builds response status: {}", status);
        
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            println!("Builds error response: {}", body);
            anyhow::bail!("API error {}: {}", status, body);
        }

        let data: serde_json::Value = response.json().await?;
        
        // Debug: print full first build to see actual structure
        if let Some(builds_array) = data["data"].as_array() {
            if let Some(first_build) = builds_array.first() {
                println!("\n=== FIRST BUILD DATA ===");
                println!("{}", serde_json::to_string_pretty(first_build).unwrap_or_default());
                println!("========================\n");
            }
        }
        
        let builds: Vec<Build> = serde_json::from_value(data["data"].clone())
            .map_err(|e| {
                println!("Failed to parse builds: {:?}", e);
                e
            })?;
        println!("Successfully parsed {} builds", builds.len());
        if let Some(first) = builds.first() {
            println!("First build workflow: {:?}", first.workflow);
        }
        Ok(builds)
    }

    pub async fn get_artifacts(&self, app_slug: &str, build_slug: &str) -> anyhow::Result<Vec<Artifact>> {
        let url = format!(
            "{}/apps/{}/builds/{}/artifacts",
            BITRISE_API_BASE, app_slug, build_slug
        );
        let response = self.client
            .get(&url)
            .header("Authorization", format!("token {}", self.token))
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("Failed to fetch artifacts: {}", response.status());
        }

        let data: serde_json::Value = response.json().await?;
        let artifacts: Vec<Artifact> = serde_json::from_value(data["data"].clone())?;
        Ok(artifacts)
    }

    pub async fn download_artifact(
        &self,
        app_slug: &str,
        build_slug: &str,
        artifact_slug: &str,
        file_name: &str,
    ) -> anyhow::Result<String> {
        // Get the cache directory
        let cache_dir = crate::fs::get_cache_dir()?;
        
        // Create full path
        let save_path = cache_dir.join(file_name);
        let save_path_str = save_path.to_string_lossy().to_string();
        
        println!("Downloading artifact to cache: {}", save_path_str);
        
        let url = format!(
            "{}/apps/{}/builds/{}/artifacts/{}",
            BITRISE_API_BASE, app_slug, build_slug, artifact_slug
        );
        let response = self.client
            .get(&url)
            .header("Authorization", format!("token {}", self.token))
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("Failed to get artifact info: {}", response.status());
        }

        let data: serde_json::Value = response.json().await?;
        let download_url = data["data"]["expiring_download_url"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("No download URL found"))?;

        println!("Download URL obtained, fetching artifact...");
        let artifact_response = self.client.get(download_url).send().await?;
        let bytes = artifact_response.bytes().await?;
        
        println!("Writing {} bytes to {}", bytes.len(), save_path_str);
        tokio::fs::write(&save_path, bytes).await?;
        println!("Download complete!");
        
        Ok(save_path_str)
    }
}