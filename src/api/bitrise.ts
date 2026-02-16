import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { BaseDirectory, writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';
import { App, Build, Artifact } from '../types';

const BITRISE_API_BASE = 'https://api.bitrise.io/v0.1';

export class BitriseClient {
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  async getApps(): Promise<App[]> {
    const url = `${BITRISE_API_BASE}/apps`;
    console.log('[BitriseClient] Fetching apps from:', url);
    console.log('[BitriseClient] Token (first 10 chars):', this.token.substring(0, 10) + '...');

    try {
      const response = await tauriFetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `token ${this.token}`,
        },
      });

      console.log('[BitriseClient] Response status:', response.status);
      console.log('[BitriseClient] Response ok:', response.ok);
      console.log('[BitriseClient] Response headers:', response.headers);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('[BitriseClient] Error response body:', errorBody);
        throw new Error(`Failed to fetch apps: ${response.status} - ${errorBody}`);
      }

      const data = await response.json() as { data: App[] };
      console.log('[BitriseClient] Apps received:', data.data.length);
      console.log('[BitriseClient] First app:', data.data[0]);
      return data.data;
    } catch (error) {
      console.error('[BitriseClient] Exception in getApps:', error);
      console.error('[BitriseClient] Error type:', typeof error);
      console.error('[BitriseClient] Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  async getBuilds(appSlug: string, branch?: string, next?: string): Promise<{ builds: Build[]; next?: string }> {
    let url = `${BITRISE_API_BASE}/apps/${appSlug}/builds?limit=50`;
    if (branch) {
      url += `&branch=${encodeURIComponent(branch)}`;
    }
    if (next) {
      url += `&next=${encodeURIComponent(next)}`;
    }
    console.log('[BitriseClient] Fetching builds from:', url);

    const response = await tauriFetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `token ${this.token}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[BitriseClient] Builds error response:', body);
      throw new Error(`API error ${response.status}: ${body}`);
    }

    const data = await response.json() as { data: any[]; paging?: { next?: string } };
    console.log('[BitriseClient] Successfully parsed', data.data.length, 'builds');

    // Map triggered_workflow to workflow (Bitrise API returns triggered_workflow)
    const builds: Build[] = data.data.map((build: any) => ({
      ...build,
      workflow: build.workflow || build.triggered_workflow,
    }));

    return { builds, next: data.paging?.next };
  }

  async getArtifacts(appSlug: string, buildSlug: string): Promise<Artifact[]> {
    const url = `${BITRISE_API_BASE}/apps/${appSlug}/builds/${buildSlug}/artifacts`;
    console.log('[BitriseClient] Fetching artifacts from:', url);

    const response = await tauriFetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `token ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch artifacts: ${response.status}`);
    }

    const data = await response.json() as { data: Artifact[] };
    console.log('[BitriseClient] Artifacts received:', data.data.length);
    return data.data;
  }

  async downloadArtifact(
    appSlug: string,
    buildSlug: string,
    artifactSlug: string,
    fileName: string
  ): Promise<string> {
    // Get cache directory path
    const cacheDirName = '.bitrise-artifacts/cache';

    // Ensure cache directory exists
    try {
      const cacheExists = await exists(cacheDirName, { baseDir: BaseDirectory.Home });
      if (!cacheExists) {
        console.log('[BitriseClient] Creating cache directory:', cacheDirName);
        await mkdir(cacheDirName, { baseDir: BaseDirectory.Home, recursive: true });
      }
    } catch (error) {
      console.error('[BitriseClient] Error checking/creating cache dir:', error);
      throw new Error(`Failed to create cache directory: ${error}`);
    }

    const cacheFilePath = `${cacheDirName}/${fileName}`;
    console.log('[BitriseClient] Downloading artifact to cache:', cacheFilePath);

    // Step 1: Get artifact metadata with expiring download URL
    const metadataUrl = `${BITRISE_API_BASE}/apps/${appSlug}/builds/${buildSlug}/artifacts/${artifactSlug}`;
    const metadataResponse = await tauriFetch(metadataUrl, {
      method: 'GET',
      headers: {
        'Authorization': `token ${this.token}`,
      },
    });

    if (!metadataResponse.ok) {
      throw new Error(`Failed to get artifact info: ${metadataResponse.status}`);
    }

    const metadataJson = await metadataResponse.json() as {
      data: { expiring_download_url?: string }
    };
    const downloadUrl = metadataJson.data.expiring_download_url;

    if (!downloadUrl) {
      throw new Error('No download URL found in artifact metadata');
    }

    console.log('[BitriseClient] Download URL obtained, fetching artifact...');

    // Step 2: Download the actual file
    const artifactResponse = await tauriFetch(downloadUrl, {
      method: 'GET',
    });

    if (!artifactResponse.ok) {
      throw new Error(`Failed to download artifact: ${artifactResponse.status}`);
    }

    const bytes = new Uint8Array(await artifactResponse.arrayBuffer());
    console.log('[BitriseClient] Writing', bytes.length, 'bytes to', cacheFilePath);

    // Step 3: Write to cache directory
    await writeFile(cacheFilePath, bytes, { baseDir: BaseDirectory.Home });
    console.log('[BitriseClient] Download complete!');

    // Step 4: Construct and return the absolute path
    // The Rust commands (installApk, saveToDownloads) expect absolute paths
    const home = await homeDir();
    const absolutePath = `${home}/.bitrise-artifacts/cache/${fileName}`;
    console.log('[BitriseClient] Absolute path:', absolutePath);

    return absolutePath;
  }
}
