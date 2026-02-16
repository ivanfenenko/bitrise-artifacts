import { invoke } from "@tauri-apps/api/core";
import { App, Build, Artifact, Device, Settings } from "../types";

// Helper to log API calls
async function invokeWithLogging<T>(
  command: string, 
  args: Record<string, unknown> = {}
): Promise<T> {
  console.log(`[API Request] ${command}`, args);
  try {
    const result = await invoke<T>(command, args);
    console.log(`[API Response] ${command}:`, result);
    return result;
  } catch (error) {
    console.error(`[API Error] ${command}:`, error);
    throw error;
  }
}

export const api = {
  async getApps(token: string): Promise<App[]> {
    return invokeWithLogging("get_apps", { token });
  },

  async getBuilds(appSlug: string): Promise<Build[]> {
    const builds = await invokeWithLogging<Build[]>("get_builds", { appSlug });
    console.log("Builds received in frontend:", builds);
    if (builds && builds.length > 0) {
      console.log("First build workflow:", builds[0].workflow);
    }
    return builds;
  },

  async getArtifacts(appSlug: string, buildSlug: string): Promise<Artifact[]> {
    return invokeWithLogging("get_artifacts", { 
      appSlug, 
      buildSlug 
    });
  },

  async downloadArtifact(
    appSlug: string,
    buildSlug: string,
    artifactSlug: string,
    fileName: string
  ): Promise<string> {
    return invokeWithLogging("download_artifact", {
      appSlug,
      buildSlug,
      artifactSlug,
      fileName,
    });
  },

  async getConnectedDevices(): Promise<Device[]> {
    return invokeWithLogging("get_connected_devices");
  },

  async installApk(apkPath: string, deviceId?: string): Promise<string> {
    return invokeWithLogging("install_apk", {
      apkPath,
      deviceId,
    });
  },

  async saveToDownloads(cachePath: string, fileName: string): Promise<string> {
    return invokeWithLogging("save_to_downloads", {
      cachePath,
      fileName,
    });
  },

  async saveSettings(settings: Settings): Promise<void> {
    return invokeWithLogging("save_settings", { settings });
  },

  async loadSettings(): Promise<Settings> {
    return invokeWithLogging("load_settings");
  },
};
