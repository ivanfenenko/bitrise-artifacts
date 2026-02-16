import { App } from "../types";
import { FolderGit2, Plus, X, GitBranch, List } from "lucide-react";

export type StatusFilter = "all" | "success" | "failed";

interface SidebarProps {
  apps: App[];
  selectedApp: App | null;
  onSelectApp: (app: App) => void;
  onRemoveApp: (appSlug: string) => void;
  onAddApp: () => void;
  branches: string[];
  selectedBranch: string | null;
  onSelectBranch: (branch: string) => void;
  onRemoveBranch: (branch: string) => void;
  onClearBranchFilter: () => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  width: number;
}

export function Sidebar({
  apps,
  selectedApp,
  onSelectApp,
  onRemoveApp,
  onAddApp,
  branches,
  selectedBranch,
  onSelectBranch,
  onRemoveBranch,
  onClearBranchFilter,
  statusFilter,
  onStatusFilterChange,
  width,
}: SidebarProps) {
  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "success", label: "Success" },
    { value: "failed", label: "Failed" },
  ];
  return (
    <aside className="bg-surface border-r border-border flex flex-col shrink-0" style={{ width }}>
      {/* Apps section */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Watchlist
        </h2>
        <button
          onClick={onAddApp}
          className="p-1 hover:bg-surface-hover rounded transition-colors"
          title="Add app"
        >
          <Plus size={16} className="text-text-secondary" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {apps.length === 0 ? (
          <div className="p-4 text-sm text-text-muted text-center">
            <p>No apps in watchlist</p>
            <button
              onClick={onAddApp}
              className="mt-2 text-primary hover:underline text-xs"
            >
              Add your first app
            </button>
          </div>
        ) : (
          <div className="p-2">
            {apps.map((app) => (
              <div
                key={app.slug}
                className={`group w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  selectedApp?.slug === app.slug
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-surface-hover text-text-secondary"
                }`}
              >
                <button
                  onClick={() => onSelectApp(app)}
                  className="flex-1 flex items-center gap-3 min-w-0"
                >
                  <FolderGit2 size={18} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{app.title}</p>
                    {app.repo_slug && (
                      <p className="text-xs text-text-muted truncate">
                        {app.repo_slug}
                      </p>
                    )}
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveApp(app.slug);
                  }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-surface-hover transition-all shrink-0"
                  title="Remove from watchlist"
                >
                  <X size={14} className="text-text-muted" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Branches section */}
        {selectedApp && (
          <>
            <div className="px-4 py-3 border-t border-border">
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Branches
              </h2>
            </div>
            <div className="px-2 pb-2">
              {/* All Builds item */}
              <button
                onClick={onClearBranchFilter}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  selectedBranch === null
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-surface-hover text-text-secondary"
                }`}
              >
                <List size={16} className="shrink-0" />
                <span className="text-sm font-medium">All Builds</span>
              </button>

              {/* Watched branches */}
              {branches.map((branch) => (
                <div
                  key={branch}
                  className={`group flex items-center gap-2 rounded-lg transition-colors ${
                    selectedBranch === branch
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-surface-hover text-text-secondary"
                  }`}
                >
                  <button
                    onClick={() => onSelectBranch(branch)}
                    className="flex-1 flex items-center gap-3 px-3 py-2 min-w-0"
                  >
                    <GitBranch size={16} className="shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {branch}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBranch(branch);
                    }}
                    className="p-1 mr-2 rounded opacity-0 group-hover:opacity-100 hover:bg-surface-hover transition-all shrink-0"
                    title="Remove branch"
                  >
                    <X size={14} className="text-text-muted" />
                  </button>
                </div>
              ))}
            </div>

            {/* Status filter */}
            <div className="px-4 py-3 border-t border-border">
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Filter by Status
              </h2>
              <div className="flex rounded-lg overflow-hidden border border-border">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onStatusFilterChange(opt.value)}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                      statusFilter === opt.value
                        ? "bg-primary text-white"
                        : "bg-surface hover:bg-surface-hover text-text-secondary"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
