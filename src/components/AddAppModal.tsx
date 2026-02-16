import { useState, useEffect, useMemo } from "react";
import { App } from "../types";
import { api } from "../api";
import { X, Search, Plus, Check, Loader2 } from "lucide-react";

interface AddAppModalProps {
  apiToken: string;
  watchlistApps: App[];
  onAddApp: (app: App) => void;
  onRemoveApp: (appSlug: string) => void;
  onClose: () => void;
}

export function AddAppModal({
  apiToken,
  watchlistApps,
  onAddApp,
  onRemoveApp,
  onClose,
}: AddAppModalProps) {
  const [allApps, setAllApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const watchlistSlugs = useMemo(
    () => new Set(watchlistApps.map((a) => a.slug)),
    [watchlistApps]
  );

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const apps = await api.getApps(apiToken);
        setAllApps(apps);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch apps"
        );
      } finally {
        setLoading(false);
      }
    };
    fetchApps();
  }, [apiToken]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allApps;
    const q = search.toLowerCase();
    return allApps.filter(
      (app) =>
        app.title.toLowerCase().includes(q) ||
        (app.repo_slug && app.repo_slug.toLowerCase().includes(q))
    );
  }, [allApps, search]);

  const toggleApp = (app: App) => {
    if (watchlistSlugs.has(app.slug)) {
      onRemoveApp(app.slug);
    } else {
      onAddApp(app);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Add Apps</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search apps..."
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-primary text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* App list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-error text-sm">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-text-muted text-sm">
              {search ? "No apps match your search" : "No apps found"}
            </div>
          ) : (
            <div className="p-2">
              {filtered.map((app) => {
                const isWatched = watchlistSlugs.has(app.slug);
                return (
                  <button
                    key={app.slug}
                    onClick={() => toggleApp(app)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      isWatched
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-surface-hover text-text-secondary"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {app.title}
                      </p>
                      {app.repo_slug && (
                        <p className="text-xs text-text-muted truncate">
                          {app.repo_slug}
                        </p>
                      )}
                    </div>
                    {isWatched ? (
                      <Check size={16} className="text-primary shrink-0" />
                    ) : (
                      <Plus size={16} className="text-text-muted shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border text-center text-xs text-text-muted">
          {watchlistApps.length} app{watchlistApps.length !== 1 ? "s" : ""} in
          watchlist
        </div>
      </div>
    </div>
  );
}
