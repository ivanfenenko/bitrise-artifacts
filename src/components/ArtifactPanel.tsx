import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { Build, Artifact, Device, DownloadedArtifactInfo } from "../types";
import { api } from "../api";
import { format } from "date-fns";
import {
  FileArchive,
  Download,
  Smartphone,
  ExternalLink,
  Loader2,
  Package,
  X,
  File,
} from "lucide-react";

interface ArtifactPanelProps {
  build: Build | null;
  appSlug?: string;
  downloadedArtifacts: Record<string, DownloadedArtifactInfo>;
  onUpdateDownloadedArtifacts: Dispatch<SetStateAction<Record<string, DownloadedArtifactInfo>>>;
  onClose?: () => void;
}

export function ArtifactPanel({ build, appSlug, downloadedArtifacts, onUpdateDownloadedArtifacts, onClose }: ArtifactPanelProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingSlug, setDownloadingSlug] = useState<string | null>(null);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);
  const [deviceOptions, setDeviceOptions] = useState<Device[]>([]);
  const [devicePicker, setDevicePicker] = useState<
    { artifactSlug: string; apkPath: string } | null
  >(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  useEffect(() => {
    if (build && appSlug) {
      fetchArtifacts();
    } else {
      setArtifacts([]);
    }
    setDownloadingSlug(null);
    setSavingSlug(null);
    setInstallingSlug(null);
    setDevicePicker(null);
  }, [build, appSlug]);

  useEffect(() => {
    if (!snackbar) return;
    const timer = setTimeout(() => setSnackbar(null), 3500);
    return () => clearTimeout(timer);
  }, [snackbar]);

  const fetchArtifacts = async () => {
    if (!build?.slug || !appSlug) return;
    
    setLoading(true);
    try {
      const artifactList = await api.getArtifacts(appSlug, build.slug);
      setArtifacts(artifactList);
    } catch (err) {
      console.error("Failed to fetch artifacts", err);
    } finally {
      setLoading(false);
    }
  };

  const formatFilename = (branch?: string, originalFilename?: string): string => {
    if (!originalFilename) return "artifact";

    // Split into base name and extension
    const dotIdx = originalFilename.lastIndexOf('.');
    const baseName = dotIdx > 0 ? originalFilename.substring(0, dotIdx) : originalFilename;
    const ext = dotIdx > 0 ? originalFilename.substring(dotIdx) : "";

    if (!branch) return originalFilename;

    // Extract ticket number from branch (e.g., AND-240 from feature/AND-240_description)
    const ticketMatch = branch.match(/([A-Z]+-\d+)/);
    const ticketNumber = ticketMatch ? ticketMatch[1] : null;

    // If develop or master, append date
    if (branch === "develop" || branch === "master" || branch.endsWith("/develop") || branch.endsWith("/master")) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      return `${baseName}-${today}${ext}`;
    }

    // If we found a ticket number, append it
    if (ticketNumber) {
      return `${baseName}-${ticketNumber}${ext}`;
    }

    // Otherwise just use the original filename
    return originalFilename;
  };

  const handleDownload = async (artifact: Artifact) => {
    if (!appSlug || !build?.slug || !artifact.slug) {
      setSnackbar({ type: "error", message: "Missing data — cannot download this artifact." });
      return;
    }

    const artifactKey = `${appSlug}:${build.slug}:${artifact.slug}`;

    const rawName = artifact.title || `artifact-${artifact.slug}`;
    const filename = formatFilename(build.branch, rawName);
    setDownloadingSlug(artifact.slug);
    try {
      const savePath = await api.downloadArtifact(
        appSlug,
        build.slug,
        artifact.slug,
        filename
      );
      onUpdateDownloadedArtifacts(prev => ({
        ...prev,
        [artifactKey]: { path: savePath, fileName: filename },
      }));
      try {
        const downloadsPath = await api.saveToDownloads(savePath, filename);
        onUpdateDownloadedArtifacts(prev => ({
          ...prev,
          [artifactKey]: {
            path: savePath,
            fileName: filename,
            downloadPath: downloadsPath,
          },
        }));
        setSnackbar({ type: "success", message: `Saved to Downloads: ${downloadsPath}` });
      } catch (saveErr) {
        console.error("Save to Downloads failed:", saveErr);
        setSnackbar({
          type: "error",
          message: "Downloaded to cache, but failed to save to Downloads: " +
            (saveErr instanceof Error ? saveErr.message : String(saveErr)),
        });
      }
    } catch (err) {
      console.error("Download failed:", err);
      setSnackbar({
        type: "error",
        message: "Download failed: " + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setDownloadingSlug(null);
    }
  };

  const handleSaveToDownloads = async (artifact: Artifact) => {
    if (!artifact.slug) return;
    const cached = appSlug && build?.slug
      ? downloadedArtifacts[`${appSlug}:${build.slug}:${artifact.slug}`]
      : undefined;
    if (!cached) {
      setSnackbar({ type: "error", message: "Download the artifact first." });
      return;
    }

    setSavingSlug(artifact.slug);
    try {
      const savePath = await api.saveToDownloads(cached.path, cached.fileName);
      setSnackbar({
        type: "success",
        message: `Saved to Downloads: ${savePath}`,
      });
    } catch (err) {
      console.error("Save to Downloads failed:", err);
      setSnackbar({
        type: "error",
        message: "Failed to save to Downloads: " + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setSavingSlug(null);
    }
  };

  const handleOpenDownloaded = async (artifact: Artifact) => {
    const cached = artifact.slug && appSlug && build?.slug
      ? downloadedArtifacts[`${appSlug}:${build.slug}:${artifact.slug}`]
      : undefined;
    const targetPath = cached?.downloadPath || cached?.path;
    if (!targetPath) {
      setSnackbar({ type: "error", message: "No downloaded file found to open." });
      return;
    }

    try {
      await api.openPath(targetPath);
    } catch (err) {
      console.error("Open failed:", err);
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("not found") && artifact.slug && appSlug && build?.slug) {
        onUpdateDownloadedArtifacts(prev => {
          const next = { ...prev };
          delete next[`${appSlug}:${build.slug}:${artifact.slug}`];
          return next;
        });
      }
      setSnackbar({
        type: "error",
        message: "Failed to open file: " + message,
      });
    }
  };

  const installApkToDevice = async (apkPath: string, deviceId?: string) => {
    try {
      await api.installAndLaunchApk(apkPath, deviceId);
      setSnackbar({
        type: "success",
        message: "APK installed and launched.",
      });
    } catch (err) {
      console.error("Install failed:", err);
      setSnackbar({
        type: "error",
        message: "Failed to install or launch APK: " + (err instanceof Error ? err.message : String(err)),
      });
    }
  };

  const handleInstall = async (artifact: Artifact) => {
    if (!artifact.slug) return;
    const cached = appSlug && build?.slug
      ? downloadedArtifacts[`${appSlug}:${build.slug}:${artifact.slug}`]
      : undefined;
    if (!cached) {
      setSnackbar({ type: "error", message: "Download the artifact first." });
      return;
    }

    setInstallingSlug(artifact.slug);
    setDeviceLoading(true);
    try {
      const devices = await api.getConnectedDevices();
      if (devices.length === 0) {
        setSnackbar({ type: "error", message: "No connected devices found." });
        return;
      }
      if (devices.length === 1) {
        await installApkToDevice(cached.path, devices[0].id);
        return;
      }

      setDeviceOptions(devices);
      setDevicePicker({ artifactSlug: artifact.slug, apkPath: cached.path });
    } catch (err) {
      console.error("Failed to get devices:", err);
      setSnackbar({
        type: "error",
        message: "Failed to get connected devices: " + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setDeviceLoading(false);
      if (!devicePicker) {
        setInstallingSlug(null);
      }
    }
  };

  const handleSelectDevice = async (deviceId: string) => {
    if (!devicePicker) return;
    await installApkToDevice(devicePicker.apkPath, deviceId);
    setDevicePicker(null);
    setInstallingSlug(null);
  };

  const handleCloseDevicePicker = () => {
    setDevicePicker(null);
    setInstallingSlug(null);
  };

  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return "Unknown size";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };


  if (!build) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-muted p-8">
        <Package size={48} className="mb-4 opacity-50" />
        <p className="text-center">Select a build to view artifacts</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-surface">
      <div className="h-14 border-b border-border px-4 flex items-center justify-between">
        <h2 className="font-semibold text-text-primary">Artifacts</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            aria-label="Close artifacts panel"
            title="Close"
          >
            <X size={18} className="text-text-secondary" />
          </button>
        )}
      </div>

      <div className="p-4 border-b border-border bg-background/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Build
          </span>
        </div>
        <p className="font-medium text-text-primary">{build.workflow || "Unknown Workflow"}</p>
        <p className="text-sm text-text-secondary mt-1">{build.branch || "Unknown Branch"}</p>
        <p className="text-xs text-text-muted mt-1">
          {build.triggered_at 
            ? format(new Date(build.triggered_at), "MMMM d, yyyy 'at' HH:mm")
            : "Unknown date"}
        </p>
        <div className="mt-2">
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
            build.status_text?.toLowerCase() === 'success'
              ? 'bg-success/10 text-success'
              : build.status_text?.toLowerCase() === 'failed'
              ? 'bg-error/10 text-error'
              : 'bg-warning/10 text-warning'
          }`}>
            {build.status_text || "Unknown"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : artifacts.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            <FileArchive size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No artifacts found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {artifacts.map((artifact, index) => {
              const isApk = artifact.title?.toLowerCase().endsWith(".apk");
              const isHtmlReport = artifact.artifact_type?.toLowerCase() === "html_report"
                || artifact.title?.toLowerCase().endsWith(".html")
                || artifact.title?.toLowerCase().endsWith(".htm");
              const isCached = artifact.slug && appSlug && build?.slug
                ? !!downloadedArtifacts[`${appSlug}:${build.slug}:${artifact.slug}`]
                : false;

              return (
                <div
                  key={artifact.slug || index}
                  className="bg-background border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      isApk ? "bg-primary/10" : "bg-surface-hover"
                    }`}>
                      {isApk ? (
                        <Smartphone size={20} className="text-primary" />
                      ) : (
                        <File size={20} className="text-text-secondary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-text-primary truncate" title={artifact.title || undefined}>
                        {artifact.title || "Unknown Artifact"}
                      </p>
                      <p className="text-xs text-text-muted">
                        {artifact.file_size_bytes != null
                          ? formatFileSize(artifact.file_size_bytes)
                          : artifact.artifact_type || "File"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    {isHtmlReport ? (
                      <button
                        onClick={async () => {
                          if (!appSlug || !build?.slug || !artifact.slug) {
                            setSnackbar({ type: "error", message: "Missing data — cannot open report." });
                            return;
                          }
                          try {
                            const url = await api.getArtifactDownloadUrl(appSlug, build.slug, artifact.slug);
                            await api.openPath(url);
                          } catch (err) {
                            console.error("Open report failed:", err);
                            setSnackbar({
                              type: "error",
                              message: "Failed to open report: " + (err instanceof Error ? err.message : String(err)),
                            });
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-surface hover:bg-surface-hover text-text-primary text-sm font-medium rounded-lg transition-colors"
                      >
                        <ExternalLink size={16} />
                        Open report
                      </button>
                    ) : !isCached ? (
                      <button
                        onClick={() => handleDownload(artifact)}
                        disabled={!artifact.slug || !artifact.title || downloadingSlug === artifact.slug}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {downloadingSlug === artifact.slug ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Download size={16} />
                        )}
                        Download
                      </button>
                    ) : (
                      isApk ? (
                        <div className="flex-1 flex rounded-lg overflow-hidden border border-border">
                          <button
                            onClick={() => handleSaveToDownloads(artifact)}
                            disabled={savingSlug === artifact.slug}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-surface hover:bg-surface-hover text-text-primary text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {savingSlug === artifact.slug ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Download size={16} />
                            )}
                            Save to Downloads
                          </button>
                          <div className="w-px bg-border" />
                          <button
                            onClick={() => handleInstall(artifact)}
                            disabled={installingSlug === artifact.slug || deviceLoading}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {installingSlug === artifact.slug ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Smartphone size={16} />
                            )}
                            Install
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenDownloaded(artifact)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-surface hover:bg-surface-hover text-text-primary text-sm font-medium rounded-lg transition-colors"
                        >
                          <ExternalLink size={16} />
                          Open
                        </button>
                      )
                    )}

                    {artifact.is_public_page_enabled && artifact.public_install_page_url && (
                      <a
                        href={artifact.public_install_page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center px-3 py-2 border border-border hover:border-primary/50 rounded-lg transition-colors"
                        title="Open install page"
                      >
                        <ExternalLink size={16} className="text-text-secondary" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {devicePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">Select Device</h2>
              <button
                onClick={handleCloseDevicePicker}
                className="p-1 hover:bg-surface-hover rounded-lg transition-colors"
              >
                <X size={20} className="text-text-secondary" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {deviceOptions.map((device) => (
                <button
                  key={device.id}
                  onClick={() => handleSelectDevice(device.id)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-background hover:bg-surface-hover border border-border rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Smartphone size={18} className="text-primary" />
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {device.manufacturer ? `${device.manufacturer} ` : ""}{device.model}
                      </p>
                      <p className="text-xs text-text-muted truncate">{device.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {device.is_emulator != null && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover text-text-muted">
                        {device.is_emulator ? "Emulator" : "Device"}
                      </span>
                    )}
                    {device.api_level && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover text-text-muted">
                        API {device.api_level}
                      </span>
                    )}
                    <span className="text-xs text-text-secondary">Install</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-border">
              <button
                onClick={handleCloseDevicePicker}
                className="w-full px-4 py-2 border border-border hover:bg-surface-hover rounded-lg transition-colors text-text-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {snackbar && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`px-4 py-3 rounded-lg shadow-lg border text-sm font-medium max-w-[50vw] break-words ${
              snackbar.type === "success"
                ? "bg-success/10 text-success border-success/30"
                : "bg-error/10 text-error border-error/30"
            }`}
          >
            {snackbar.message}
          </div>
        </div>
      )}
    </div>
  );
}
