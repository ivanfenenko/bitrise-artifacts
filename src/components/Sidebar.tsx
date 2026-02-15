import { App } from "../types";
import { FolderGit2, ChevronRight } from "lucide-react";

interface SidebarProps {
  apps: App[];
  selectedApp: App | null;
  onSelectApp: (app: App) => void;
}

export function Sidebar({ apps, selectedApp, onSelectApp }: SidebarProps) {
  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Apps
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {apps.length === 0 ? (
          <div className="p-4 text-sm text-text-muted text-center">
            No apps found
          </div>
        ) : (
          <div className="p-2">
            {apps.map((app) => (
              <button
                key={app.slug}
                onClick={() => onSelectApp(app)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  selectedApp?.slug === app.slug
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-surface-hover text-text-secondary"
                }`}
              >
                <FolderGit2 size={18} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{app.title}</p>
                  {app.repo_slug && (
                    <p className="text-xs text-text-muted truncate">{app.repo_slug}</p>
                  )}
                </div>
                <ChevronRight 
                  size={16} 
                  className={`transition-transform ${
                    selectedApp?.slug === app.slug ? "rotate-90" : ""
                  }`} 
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}