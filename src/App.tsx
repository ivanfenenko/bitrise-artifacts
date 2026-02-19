import { useState, useEffect, useCallback, useRef } from "react";
import { api, setCachedToken } from "./api";
import { App as AppType, Build, DownloadedArtifactInfo, Settings } from "./types";
import { Sidebar } from "./components/Sidebar";
import { BuildList } from "./components/BuildList";
import { ArtifactPanel } from "./components/ArtifactPanel";
import { SettingsModal } from "./components/SettingsModal";
import { AddAppModal } from "./components/AddAppModal";
import { DeviceBar } from "./components/DeviceBar";
import { Loader2, Settings as SettingsIcon } from "lucide-react";

function App() {
  const [settings, setSettings] = useState<Settings>({ api_token: "" });
  const [watchlistApps, setWatchlistApps] = useState<AppType[]>([]);
  const [watchlistBranches, setWatchlistBranches] = useState<Record<string, string[]>>({});
  const [selectedApp, setSelectedApp] = useState<AppType | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [selectedBuild, setSelectedBuild] = useState<Build | null>(null);
  const [downloadedArtifacts, setDownloadedArtifacts] = useState<Record<string, DownloadedArtifactInfo>>({});
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddApp, setShowAddApp] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Resizable panels
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [artifactWidth, setArtifactWidth] = useState(450);
  const hasLoadedWidths = useRef(false);
  const dragging = useRef<"sidebar" | "artifact" | null>(null);
  const saveWidthTimeout = useRef<number | null>(null);

  const persistSettings = useCallback((updates: Partial<Settings>) => {
    setSettings((prev) => {
      const newSettings = { ...prev, ...updates };
      api.saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const handleLogout = useCallback(() => {
    // Reset all state to initial values
    setSettings({ api_token: "" });
    setWatchlistApps([]);
    setWatchlistBranches({});
    setSelectedApp(null);
    setSelectedBranch(null);
    setBuilds([]);
    setSelectedBuild(null);
    setDownloadedArtifacts({});
    setNextCursor(undefined);
    setError(null);
    setCachedToken("");
    
    // Show settings modal to enter new token
    setShowSettings(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!settingsLoaded) return;
    if (dragging.current === "sidebar") {
      const nextWidth = Math.max(180, Math.min(400, e.clientX));
      setSidebarWidth(nextWidth);
      
      // Debounce saving to avoid too many writes
      if (saveWidthTimeout.current) {
        window.clearTimeout(saveWidthTimeout.current);
      }
      saveWidthTimeout.current = window.setTimeout(() => {
        persistSettings({ sidebar_width: nextWidth });
      }, 100);
    } else if (dragging.current === "artifact") {
      const fromRight = window.innerWidth - e.clientX;
      const nextWidth = Math.max(280, Math.min(700, fromRight));
      setArtifactWidth(nextWidth);
      
      // Debounce saving to avoid too many writes
      if (saveWidthTimeout.current) {
        window.clearTimeout(saveWidthTimeout.current);
      }
      saveWidthTimeout.current = window.setTimeout(() => {
        persistSettings({ artifact_width: nextWidth });
      }, 100);
    }
  }, [persistSettings, settingsLoaded]);

  const handleMouseUp = useCallback(() => {
    if (dragging.current && settingsLoaded) {
      // Clear any pending debounced save
      if (saveWidthTimeout.current) {
        window.clearTimeout(saveWidthTimeout.current);
        saveWidthTimeout.current = null;
      }
      
      // Immediately save the final width
      if (dragging.current === "sidebar") {
        persistSettings({ sidebar_width: sidebarWidth });
      } else if (dragging.current === "artifact") {
        persistSettings({ artifact_width: artifactWidth });
      }
    }
    
    dragging.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [sidebarWidth, artifactWidth, persistSettings, settingsLoaded]);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const startDrag = (panel: "sidebar" | "artifact") => {
    dragging.current = panel;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await api.loadSettings();
      setSettings(saved);

      if (!hasLoadedWidths.current) {
        if (typeof saved.sidebar_width === "number") {
          setSidebarWidth(saved.sidebar_width);
        }
        if (typeof saved.artifact_width === "number") {
          setArtifactWidth(saved.artifact_width);
        }
        hasLoadedWidths.current = true;
      }

      const apps = saved.watchlist_apps || [];
      const branches = saved.watchlist_branches || {};
      setWatchlistApps(apps);
      setWatchlistBranches(branches);

      if (saved.downloaded_artifacts) {
        setDownloadedArtifacts(saved.downloaded_artifacts);
      }

      if (saved.api_token) {
        setCachedToken(saved.api_token);

        if (saved.selected_app_slug) {
          const app = apps.find((a) => a.slug === saved.selected_app_slug);
          if (app) {
            setSelectedApp(app);
            await fetchBuilds(app.slug);
          }
        }
      } else {
        setShowSettings(true);
      }
    } catch (err) {
      setError("Failed to load settings");
      setShowSettings(true);
    } finally {
      setSettingsLoaded(true);
    }
  };

  const fetchBuilds = async (appSlug: string, branch?: string) => {
    setLoading(true);
    setError(null);
    setNextCursor(undefined);
    try {
      const result = await api.getBuilds(appSlug, branch);
      setBuilds(result.builds);
      setNextCursor(result.next);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || "Failed to fetch builds");
      console.error("Fetch builds error:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreBuilds = async () => {
    if (!selectedApp || !nextCursor) return;
    setLoadingMore(true);
    try {
      const result = await api.getBuilds(selectedApp.slug, selectedBranch || undefined, nextCursor);
      setBuilds((prev) => [...prev, ...result.builds]);
      setNextCursor(result.next);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || "Failed to load more builds");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!settingsLoaded) return;
    if (!settings.api_token && !settings.selected_app_slug && !settings.watchlist_apps) return;
    persistSettings({ downloaded_artifacts: downloadedArtifacts });
  }, [downloadedArtifacts, settings.api_token, settings.selected_app_slug, settings.watchlist_apps, settingsLoaded]);

  const handleAppSelect = (app: AppType) => {
    setSelectedApp(app);
    setSelectedBuild(null);
    setSelectedBranch(null);
    fetchBuilds(app.slug);
    persistSettings({ selected_app_slug: app.slug });
  };

  const handleAddToWatchlist = (app: AppType) => {
    const updated = [...watchlistApps, app];
    setWatchlistApps(updated);
    persistSettings({ watchlist_apps: updated });
  };

  const handleRemoveFromWatchlist = (appSlug: string) => {
    const updated = watchlistApps.filter((a) => a.slug !== appSlug);
    setWatchlistApps(updated);

    // Clear selection if we removed the active app
    if (selectedApp?.slug === appSlug) {
      setSelectedApp(null);
      setSelectedBuild(null);
      setSelectedBranch(null);
      setBuilds([]);
    }

    // Clean up branches for removed app
    const newBranches = { ...watchlistBranches };
    delete newBranches[appSlug];
    setWatchlistBranches(newBranches);

    persistSettings({
      watchlist_apps: updated,
      watchlist_branches: newBranches,
      selected_app_slug: selectedApp?.slug === appSlug ? undefined : settings.selected_app_slug,
    });
  };

  const handleAddBranch = (branch: string) => {
    if (!selectedApp) return;
    const appBranches = watchlistBranches[selectedApp.slug] || [];
    if (appBranches.includes(branch)) return;

    const newBranches = {
      ...watchlistBranches,
      [selectedApp.slug]: [...appBranches, branch],
    };
    setWatchlistBranches(newBranches);
    persistSettings({ watchlist_branches: newBranches });
  };

  const handleRemoveBranch = (branch: string) => {
    if (!selectedApp) return;
    const appBranches = watchlistBranches[selectedApp.slug] || [];
    const newBranches = {
      ...watchlistBranches,
      [selectedApp.slug]: appBranches.filter((b) => b !== branch),
    };
    setWatchlistBranches(newBranches);

    // Clear branch filter if we removed the active branch
    if (selectedBranch === branch) {
      setSelectedBranch(null);
      fetchBuilds(selectedApp.slug);
    }

    persistSettings({ watchlist_branches: newBranches });
  };

  const handleSelectBranch = (branch: string) => {
    if (!selectedApp) return;
    setSelectedBranch(branch);
    setSelectedBuild(null);
    fetchBuilds(selectedApp.slug, branch);
  };

  const handleClearBranchFilter = () => {
    if (!selectedApp) return;
    setSelectedBranch(null);
    setSelectedBuild(null);
    fetchBuilds(selectedApp.slug);
  };

  const handleSaveSettings = async (newSettings: Settings) => {
    // Merge watchlist data so SettingsModal doesn't overwrite them
    const merged: Settings = {
      ...newSettings,
      watchlist_apps: watchlistApps,
      watchlist_branches: watchlistBranches,
    };
    setSettings(merged);
    await api.saveSettings(merged);
    setShowSettings(false);

    if (merged.api_token) {
      setCachedToken(merged.api_token);
    }
  };

  const currentBranches = selectedApp
    ? watchlistBranches[selectedApp.slug] || []
    : [];

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">BA</span>
          </div>
          <h1 className="font-semibold text-text-primary">Bitrise Artifacts</h1>
        </div>
        <div className="flex items-center gap-4">
          {selectedApp && (
            <span className="text-sm text-text-secondary">{selectedApp.title}</span>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <SettingsIcon size={20} className="text-text-secondary" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          apps={watchlistApps}
          selectedApp={selectedApp}
          onSelectApp={handleAppSelect}
          onRemoveApp={handleRemoveFromWatchlist}
          onAddApp={() => setShowAddApp(true)}
          branches={currentBranches}
          selectedBranch={selectedBranch}
          onSelectBranch={handleSelectBranch}
          onRemoveBranch={handleRemoveBranch}
          onClearBranchFilter={handleClearBranchFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          width={sidebarWidth}
        />
        {/* Sidebar resize handle */}
        <div
          onMouseDown={() => startDrag("sidebar")}
          className="w-1 hover:w-1 cursor-col-resize bg-transparent hover:bg-primary/30 transition-colors shrink-0"
        />

        <main className="flex-1 flex min-w-0">
          {loading && !builds.length ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <p className="text-error mb-2">{error}</p>
                <div className="flex gap-4 justify-center mt-4">
                  {selectedApp && (
                    <button
                      onClick={() => fetchBuilds(selectedApp.slug, selectedBranch || undefined)}
                      className="text-primary hover:underline"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    onClick={() => setShowSettings(true)}
                    className="text-text-secondary hover:underline"
                  >
                    Open Settings
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <BuildList
                  builds={builds}
                  appSlug={selectedApp?.slug}
                  selectedBuild={selectedBuild}
                  onSelectBuild={setSelectedBuild}
                  onRefresh={() =>
                    selectedApp &&
                    fetchBuilds(selectedApp.slug, selectedBranch || undefined)
                  }
                  watchedBranches={currentBranches}
                  onAddBranch={handleAddBranch}
                  statusFilter={statusFilter}
                  hasMore={!!nextCursor}
                  loadingMore={loadingMore}
                  onLoadMore={loadMoreBuilds}
                  activeBranchFilter={selectedBranch}
                  onBranchFilter={(branch) => {
                    if (branch) {
                      handleSelectBranch(branch);
                    } else {
                      handleClearBranchFilter();
                    }
                  }}
                />
              </div>

              {selectedBuild?.slug && (
                <>
                  {/* Artifact resize handle */}
                  <div
                    onMouseDown={() => startDrag("artifact")}
                    className="w-1 hover:w-1 cursor-col-resize bg-transparent hover:bg-primary/30 transition-colors shrink-0"
                  />
                  <div className="shrink-0" style={{ width: artifactWidth }}>
                    <ArtifactPanel
                      build={selectedBuild}
                      appSlug={selectedApp?.slug}
                      downloadedArtifacts={downloadedArtifacts}
                      onUpdateDownloadedArtifacts={setDownloadedArtifacts}
                      onClose={() => setSelectedBuild(null)}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>

      {/* Device Bar */}
      <DeviceBar />

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => {
            if (settings.api_token) {
              setShowSettings(false);
            }
          }}
          onLogout={handleLogout}
        />
      )}

      {/* Add App Modal */}
      {showAddApp && settings.api_token && (
        <AddAppModal
          apiToken={settings.api_token}
          watchlistApps={watchlistApps}
          onAddApp={handleAddToWatchlist}
          onRemoveApp={handleRemoveFromWatchlist}
          onClose={() => setShowAddApp(false)}
        />
      )}
    </div>
  );
}

export default App;
