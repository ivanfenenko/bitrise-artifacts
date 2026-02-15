import { useMemo } from "react";
import { Build } from "../types";
import { format } from "date-fns";
import { RefreshCw, GitBranch, Clock, User, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface BuildListProps {
  builds: Build[];
  selectedBuild: Build | null;
  onSelectBuild: (build: Build) => void;
  onRefresh: () => void;
}

export function BuildList({ builds, selectedBuild, onSelectBuild, onRefresh }: BuildListProps) {
  const groupedBuilds = useMemo(() => {
    const grouped: { [key: string]: Build[] } = {};
    
    builds.forEach((build) => {
      const branch = build.branch || "unknown-branch";
      if (!grouped[branch]) {
        grouped[branch] = [];
      }
      grouped[branch].push(build);
    });
    
    return grouped;
  }, [builds]);

  const getStatusIcon = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "success":
        return <CheckCircle2 size={16} className="text-success" />;
      case "failed":
        return <XCircle size={16} className="text-error" />;
      case "running":
      case "in-progress":
        return <Loader2 size={16} className="text-warning animate-spin" />;
      default:
        return <Clock size={16} className="text-text-muted" />;
    }
  };

  const branches = Object.keys(groupedBuilds).sort();

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="h-14 border-b border-border px-4 flex items-center justify-between">
        <h2 className="font-semibold text-text-primary">Builds</h2>
        <button
          onClick={onRefresh}
          className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          title="Refresh builds"
        >
          <RefreshCw size={18} className="text-text-secondary" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {builds.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            <p>Select an app to view builds</p>
          </div>
        ) : (
          <div className="p-2">
            {branches.map((branch) => (
              <div key={branch} className="mb-4">
                <div className="px-3 py-2 flex items-center gap-2 text-text-muted">
                  <GitBranch size={14} />
                  <span className="text-xs font-medium uppercase tracking-wider">
                    {branch}
                  </span>
                  <span className="text-xs">({groupedBuilds[branch].length})</span>
                </div>
                
                <div className="space-y-1">
                  {groupedBuilds[branch].map((build, index) => (
                    <button
                      key={build.slug || index}
                      onClick={() => onSelectBuild(build)}
                      className={`w-full p-3 rounded-lg text-left transition-all border ${
                        selectedBuild?.slug && build.slug && selectedBuild.slug === build.slug
                          ? "bg-primary/10 border-primary/50"
                          : "bg-surface border-transparent hover:border-border hover:bg-surface-hover"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(build.status_text)}
                          <span className="text-sm font-medium text-text-primary">
                            {build.workflow || "Unknown Workflow"}
                          </span>
                        </div>
                        <span className="text-xs text-text-muted">
                          {build.triggered_at 
                            ? format(new Date(build.triggered_at), "MMM d, HH:mm")
                            : "Unknown date"}
                        </span>
                      </div>
                      
                      {build.commit_message && (
                        <p className="mt-2 text-xs text-text-secondary truncate">
                          {build.commit_message}
                        </p>
                      )}
                      
                      {build.triggered_by && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                          <User size={12} />
                          <span>{build.triggered_by}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}