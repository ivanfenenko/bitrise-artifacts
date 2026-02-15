import { useState, useEffect } from "react";
import { api } from "./api";
import { App as AppType, Build, Settings } from "./types";
import { Sidebar } from "./components/Sidebar";
import { BuildList } from "./components/BuildList";
import { ArtifactPanel } from "./components/ArtifactPanel";
import { SettingsModal } from "./components/SettingsModal";
import { DeviceBar } from "./components/DeviceBar";
import { Loader2, Settings as SettingsIcon } from "lucide-react";

function App() {
  const [settings, setSettings] = useState<Settings>({ api_token: "" });
  const [apps, setApps] = useState<AppType[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppType | null>(null);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [selectedBuild, setSelectedBuild] = useState<Build | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await api.loadSettings();
      setSettings(saved);
      if (saved.api_token) {
        await fetchApps(saved.api_token, saved.selected_app_slug);
      } else {
        setShowSettings(true);
      }
    } catch (err) {
      setError("Failed to load settings");
      setShowSettings(true);
    }
  };

  const fetchApps = async (token: string, selectedSlug?: string) => {
    setLoading(true);
    setError(null);
    try {
      const appList = await api.getApps(token);
      setApps(appList);
      
      if (selectedSlug) {
        const app = appList.find(a => a.slug === selectedSlug);
        if (app) {
          setSelectedApp(app);
          await fetchBuilds(app.slug);
        }
      }
    } catch (err) {
      setError("Failed to fetch apps. Check your API token.");
    } finally {
      setLoading(false);
    }
  };

  const fetchBuilds = async (appSlug: string) => {
    setLoading(true);
    setError(null);
    try {
      const buildList = await api.getBuilds(appSlug);
      setBuilds(buildList);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || "Failed to fetch builds");
      console.error("Fetch builds error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAppSelect = (app: AppType) => {
    setSelectedApp(app);
    setSelectedBuild(null);
    fetchBuilds(app.slug);
    
    const newSettings = { ...settings, selected_app_slug: app.slug };
    setSettings(newSettings);
    api.saveSettings(newSettings);
  };

  const handleSaveSettings = async (newSettings: Settings) => {
    setSettings(newSettings);
    await api.saveSettings(newSettings);
    setShowSettings(false);
    if (newSettings.api_token) {
      await fetchApps(newSettings.api_token);
    }
  };

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
          apps={apps}
          selectedApp={selectedApp}
          onSelectApp={handleAppSelect}
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
                      onClick={() => fetchBuilds(selectedApp.slug)}
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
              <div className="flex-1 min-w-0 border-r border-border">
                <BuildList
                  builds={builds}
                  selectedBuild={selectedBuild}
                  onSelectBuild={setSelectedBuild}
                  onRefresh={() => selectedApp && fetchBuilds(selectedApp.slug)}
                />
              </div>

              <div className="w-[450px] min-w-[450px]">
                {selectedBuild?.slug && (
                  <ArtifactPanel
                    build={selectedBuild}
                    appSlug={selectedApp?.slug}
                  />
                )}
              </div>
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
        />
      )}
    </div>
  );
}

export default App;