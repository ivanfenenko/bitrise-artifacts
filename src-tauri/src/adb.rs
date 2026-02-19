use serde::{Deserialize, Serialize};
use std::process::Command;
use apk_info::Apk;
use std::path::PathBuf;
use std::sync::OnceLock;

static ADB_PATH: OnceLock<Option<PathBuf>> = OnceLock::new();

fn find_adb() -> Option<PathBuf> {
    // Check common locations for ADB
    let potential_paths = vec![
        // Try which adb first (PATH)
        which::which("adb").ok(),
        // Android Studio SDK (macOS)
        dirs::home_dir().map(|h| h.join("Library/Android/sdk/platform-tools/adb")),
        // Homebrew Intel
        Some(PathBuf::from("/usr/local/bin/adb")),
        // Homebrew Apple Silicon
        Some(PathBuf::from("/opt/homebrew/bin/adb")),
        // Common Linux paths
        Some(PathBuf::from("/usr/bin/adb")),
        Some(PathBuf::from("/usr/local/bin/adb")),
    ];

    for path in potential_paths.into_iter().flatten() {
        if path.exists() {
            return Some(path);
        }
    }

    None
}

fn get_adb_path() -> Option<&'static PathBuf> {
    ADB_PATH.get_or_init(find_adb).as_ref()
}

fn adb_command() -> Option<Command> {
    get_adb_path().map(|path| Command::new(path))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub id: String,
    pub model: String,
    pub status: String,
    pub manufacturer: Option<String>,
    pub device: Option<String>,
    pub api_level: Option<String>,
    pub is_emulator: Option<bool>,
}

fn get_prop(device_id: &str, prop: &str) -> Option<String> {
    let output = adb_command()?
        .args(["-s", device_id, "shell", "getprop", prop])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() { None } else { Some(value) }
}

fn is_emulator(device_id: &str) -> Option<bool> {
    if device_id.starts_with("emulator-") || device_id.starts_with("127.0.0.1:") {
        return Some(true);
    }
    let kernel_qemu = get_prop(device_id, "ro.kernel.qemu");
    kernel_qemu.map(|v| v == "1")
}

pub async fn get_devices() -> anyhow::Result<Vec<Device>> {
    let mut cmd = adb_command()
        .ok_or_else(|| anyhow::anyhow!("ADB not found. Please install Android SDK Platform Tools or add ADB to PATH"))?;
    
    let output = cmd.args(&["devices", "-l"]).output()?;

    if !output.status.success() {
        anyhow::bail!("Failed to run adb devices");
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();

    for line in stdout.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let id = parts[0].to_string();
            let status = parts[1].to_string();
            
            let model = parts.iter()
                .find(|p| p.starts_with("model:"))
                .map(|m| m.trim_start_matches("model:").to_string())
                .unwrap_or_else(|| "Unknown".to_string());

            if status == "device" {
                let manufacturer = get_prop(&id, "ro.product.manufacturer");
                let device_name = get_prop(&id, "ro.product.device");
                let api_level = get_prop(&id, "ro.build.version.sdk");
                let emulator_flag = is_emulator(&id);
                devices.push(Device {
                    id,
                    model,
                    status,
                    manufacturer,
                    device: device_name,
                    api_level,
                    is_emulator: emulator_flag,
                });
            }
        }
    }

    Ok(devices)
}

pub async fn install_apk(apk_path: &str, device_id: Option<&str>) -> anyhow::Result<String> {
    let mut cmd = adb_command()
        .ok_or_else(|| anyhow::anyhow!("ADB not found. Please install Android SDK Platform Tools or add ADB to PATH"))?;
    
    if let Some(id) = device_id {
        cmd.args(&["-s", id]);
    }
    
    cmd.args(&["install", "-r", apk_path]);
    
    let output = cmd.output()?;
    
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("Installation failed: {}", stderr);
    }
}

pub fn get_package_name(apk_path: &str) -> anyhow::Result<String> {
    let apk = Apk::new(apk_path).map_err(|e| anyhow::anyhow!("Failed to read APK: {}", e))?;
    let package = apk.get_package_name().ok_or_else(|| anyhow::anyhow!("Package name not found in APK"))?;
    Ok(package)
}

fn launch_package(package_name: &str, device_id: Option<&str>) -> anyhow::Result<String> {
    let mut cmd = adb_command()
        .ok_or_else(|| anyhow::anyhow!("ADB not found. Please install Android SDK Platform Tools or add ADB to PATH"))?;

    if let Some(id) = device_id {
        cmd.args(["-s", id]);
    }

    cmd.args([
        "shell",
        "monkey",
        "-p",
        package_name,
        "-c",
        "android.intent.category.LAUNCHER",
        "1",
    ]);

    let output = cmd.output()?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("Launch failed: {}", stderr);
    }
}

pub async fn uninstall_apk(package_name: &str, device_id: Option<&str>) -> anyhow::Result<String> {
    let mut cmd = adb_command()
        .ok_or_else(|| anyhow::anyhow!("ADB not found. Please install Android SDK Platform Tools or add ADB to PATH"))?;
    
    if let Some(id) = device_id {
        cmd.args(&["-s", id]);
    }
    
    cmd.args(&["uninstall", package_name]);
    
    let output = cmd.output()?;
    
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("Uninstall failed: {}", stderr);
    }
}

pub async fn install_and_launch_apk(apk_path: &str, device_id: Option<&str>) -> anyhow::Result<String> {
    let install_output = install_apk(apk_path, device_id).await?;
    let package_name = get_package_name(apk_path)?;
    let launch_output = launch_package(&package_name, device_id)?;
    Ok(format!("Installed and launched {}. {} {}", package_name, install_output.trim(), launch_output.trim()))
}

pub fn check_adb_available() -> bool {
    get_adb_path().is_some()
}

pub fn get_adb_location() -> Option<String> {
    get_adb_path().map(|p| p.display().to_string())
}
