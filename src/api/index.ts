import { invoke } from "@tauri-apps/api/core";
import { App, Build, Artifact, Device, Settings } from "../types";
import { BitriseClient } from "./bitrise";

// Cache the API token for BitriseClient reuse
let cachedToken: string | null = null;

export function setCachedToken(token: string) {
  cachedToken = token;
}

// Helper to log API calls (used for Rust commands only)
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
  // Bitrise API calls - now using BitriseClient in React
  async getApps(token: string): Promise<App[]> {
    console.log("[API] getApps called");
    console.log("[API] Token length:", token.length);
    console.log("[API] Token (first 10 chars):", token.substring(0, 10) + '...');

    try {
      cachedToken = token; // Cache token for subsequent calls
      const client = new BitriseClient(token);
      console.log("[API] BitriseClient created, calling getApps...");
      const result = await client.getApps();
      console.log("[API] getApps returned", result.length, "apps");
      return result;
    } catch (error) {
      console.error("[API] Error in getApps:", error);
      console.error("[API] Error message:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  },

  async getBuilds(appSlug: string, branch?: string, next?: string): Promise<{ builds: Build[]; next?: string }> {
    console.log("[API] getBuilds called for app:", appSlug, branch ? `branch: ${branch}` : "", next ? `next: ${next}` : "");
    if (!cachedToken) {
      throw new Error("No API token available. Please set token first via getApps()");
    }
    const client = new BitriseClient(cachedToken);
    return client.getBuilds(appSlug, branch, next);
  },

  async getBranches(appSlug: string): Promise<string[]> {
    if (!cachedToken) {
      throw new Error("No API token available. Please set token first via getApps()");
    }
    const client = new BitriseClient(cachedToken);
    return client.getBranches(appSlug);
  },

  async getArtifacts(appSlug: string, buildSlug: string): Promise<Artifact[]> {
    console.log("[API] getArtifacts called for build:", buildSlug);
    if (!cachedToken) {
      throw new Error("No API token available. Please set token first via getApps()");
    }
    const client = new BitriseClient(cachedToken);
    return client.getArtifacts(appSlug, buildSlug);
  },

  async downloadArtifact(
    appSlug: string,
    buildSlug: string,
    artifactSlug: string,
    fileName: string
  ): Promise<string> {
    console.log("[API] downloadArtifact called for:", fileName);
    if (!cachedToken) {
      throw new Error("No API token available. Please set token first via getApps()");
    }
    const client = new BitriseClient(cachedToken);
    return client.downloadArtifact(appSlug, buildSlug, artifactSlug, fileName);
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

  async openPath(path: string): Promise<void> {
    return invokeWithLogging("open_path", { path });
  },

  async saveSettings(settings: Settings): Promise<void> {
    return invokeWithLogging("save_settings", { settings });
  },

  async loadSettings(): Promise<Settings> {
    return invokeWithLogging("load_settings");
  },
};
