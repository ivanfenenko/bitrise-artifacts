import { useState, useEffect } from "react";
import { Build, Artifact } from "../types";
import { api } from "../api";
import { format } from "date-fns";
import { 
  FileArchive, 
  Download, 
  Smartphone, 
  ExternalLink,
  Loader2,
  Package
} from "lucide-react";

interface ArtifactPanelProps {
  build: Build | null;
  appSlug?: string;
}

export function ArtifactPanel({ build, appSlug }: ArtifactPanelProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingSlug, setDownloadingSlug] = useState<string | null>(null);

  useEffect(() => {
    if (build && appSlug) {
      fetchArtifacts();
    } else {
      setArtifacts([]);
    }
  }, [build, appSlug]);

  const fetchArtifacts = async () => {
    if (!build?.slug || !appSlug) return;
    
    setLoading(true);
    try {
      const artifactList = await api.getArtifacts(appSlug, build.slug);
      setArtifacts(artifactList.filter(a => a.title?.endsWith('.apk')));
    } catch (err) {
      console.error("Failed to fetch artifacts", err);
    } finally {
      setLoading(false);
    }
  };

  const formatFilename = (branch?: string, originalFilename?: string): string => {
    if (!originalFilename) return "artifact.apk";
    
    // Remove .apk extension from original filename
    const baseName = originalFilename.replace(/\.apk$/i, '');
    
    if (!branch) return originalFilename;
    
    // Extract ticket number from branch (e.g., AND-240 from feature/AND-240_description)
    const ticketMatch = branch.match(/([A-Z]+-\d+)/);
    const ticketNumber = ticketMatch ? ticketMatch[1] : null;
    
    // If develop or master, append date
    if (branch === "develop" || branch === "master" || branch.endsWith("/develop") || branch.endsWith("/master")) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      return `${baseName}-${today}.apk`;
    }
    
    // If we found a ticket number, append it
    if (ticketNumber) {
      return `${baseName}-${ticketNumber}.apk`;
    }
    
    // Otherwise just use the original filename
    return originalFilename;
  };

  const handleDownload = async (artifact: Artifact) => {
    if (!appSlug || !build?.slug || !artifact.slug || !artifact.title) {
      console.error("Missing required data for download", { appSlug, buildSlug: build?.slug, artifactSlug: artifact.slug, title: artifact.title });
      return;
    }
    
    const filename = formatFilename(build.branch, artifact.title);
    console.log("Starting download for:", filename);
    setDownloadingSlug(artifact.slug);
    try {
      const savePath = await api.downloadArtifact(
        appSlug,
        build.slug,
        artifact.slug,
        filename
      );
      console.log("Download complete:", savePath);
      alert(`Downloaded to: ${savePath}`);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download artifact: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDownloadingSlug(null);
    }
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
      <div className="h-14 border-b border-border px-4 flex items-center">
        <h2 className="font-semibold text-text-primary">Artifacts</h2>
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
            <p className="text-sm">No APK artifacts found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {artifacts.map((artifact, index) => (
              <div
                key={artifact.slug || index}
                className="bg-background border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Smartphone size={20} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate">
                        {artifact.title || "Unknown Artifact"}
                      </p>
                      <p className="text-xs text-text-muted">
                        {artifact.file_size !== undefined ? formatFileSize(artifact.file_size) : "Unknown size"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}