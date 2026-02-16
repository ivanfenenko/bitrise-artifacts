import { Build } from "../types";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import { RefreshCw, Clock, User, CheckCircle2, XCircle, Loader2, ChevronRight, ChevronDown, Layers } from "lucide-react";

interface BuildListProps {
  builds: Build[];
  selectedBuild: Build | null;
  onSelectBuild: (build: Build) => void;
  onRefresh: () => void;
}

type BuildGroup = { type: "single"; build: Build } | { type: "pipeline"; buildNumber: number; builds: Build[] };

function groupBuilds(builds: Build[]): BuildGroup[] {
  const groups: BuildGroup[] = [];
  const byNumber = new Map<number, Build[]>();
  const noBuildNumber: Build[] = [];

  for (const build of builds) {
    if (build.build_number != null) {
      const existing = byNumber.get(build.build_number);
      if (existing) {
        existing.push(build);
      } else {
        byNumber.set(build.build_number, [build]);
      }
    } else {
      noBuildNumber.push(build);
    }
  }

  // Track which builds have been placed into groups
  const processed = new Set<number>();

  // Walk builds in original order, emitting groups at the position of their first build
  for (const build of builds) {
    if (build.build_number == null) {
      groups.push({ type: "single", build });
      continue;
    }
    if (processed.has(build.build_number)) continue;
    processed.add(build.build_number);

    const members = byNumber.get(build.build_number)!;
    if (members.length === 1) {
      groups.push({ type: "single", build: members[0] });
    } else {
      groups.push({ type: "pipeline", buildNumber: build.build_number, builds: members });
    }
  }

  return groups;
}

function computePipelineStatus(builds: Build[]): string {
  const statuses = builds.map((b) => b.status_text?.toLowerCase());
  if (statuses.some((s) => s === "failed")) return "failed";
  if (statuses.some((s) => s === "running" || s === "in-progress")) return "running";
  if (statuses.every((s) => s === "success")) return "success";
  return "unknown";
}

export function BuildList({ builds, selectedBuild, onSelectBuild, onRefresh }: BuildListProps) {
  const [expandedPipelines, setExpandedPipelines] = useState<Set<number>>(new Set());

  const groups = useMemo(() => groupBuilds(builds), [builds]);

  const togglePipeline = (buildNumber: number) => {
    setExpandedPipelines((prev) => {
      const next = new Set(prev);
      if (next.has(buildNumber)) {
        next.delete(buildNumber);
      } else {
        next.add(buildNumber);
      }
      return next;
    });
  };

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

  const isSelected = (build: Build) =>
    selectedBuild?.slug != null && build.slug != null && selectedBuild.slug === build.slug;

  const renderBuildButton = (build: Build, indented: boolean) => (
    <button
      key={build.slug || Math.random()}
      onClick={() => onSelectBuild(build)}
      className={`w-full p-3 rounded-lg text-left transition-all border ${
        indented ? "ml-4 w-[calc(100%-1rem)]" : ""
      } ${
        isSelected(build)
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
  );

  const renderPipelineGroup = (group: BuildGroup & { type: "pipeline" }) => {
    const expanded = expandedPipelines.has(group.buildNumber);
    const first = group.builds[0];
    const status = computePipelineStatus(group.builds);
    const hasSelectedChild = group.builds.some(isSelected);

    return (
      <div key={`pipeline-${group.buildNumber}`}>
        <button
          onClick={() => togglePipeline(group.buildNumber)}
          className={`w-full p-3 rounded-lg text-left transition-all border ${
            hasSelectedChild && !expanded
              ? "bg-primary/10 border-primary/50"
              : "bg-surface border-transparent hover:border-border hover:bg-surface-hover"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {expanded
                ? <ChevronDown size={16} className="text-text-muted" />
                : <ChevronRight size={16} className="text-text-muted" />}
              {getStatusIcon(status)}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">
                  #{group.buildNumber}
                </span>
                <span className="text-xs text-text-muted">
                  {first.branch || "unknown branch"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-surface-hover text-text-secondary">
                <Layers size={12} />
                {group.builds.length} workflows
              </span>
              <span className="text-xs text-text-muted">
                {first.triggered_at
                  ? format(new Date(first.triggered_at), "MMM d, HH:mm")
                  : ""}
              </span>
            </div>
          </div>

          {first.commit_message && (
            <p className="mt-2 text-xs text-text-secondary truncate ml-6">
              {first.commit_message}
            </p>
          )}
        </button>

        {expanded && (
          <div className="space-y-1 mt-1">
            {group.builds.map((build) => renderBuildButton(build, true))}
          </div>
        )}
      </div>
    );
  };

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
            <div className="space-y-1">
              {groups.map((group) =>
                group.type === "single"
                  ? renderBuildButton(group.build, false)
                  : renderPipelineGroup(group)
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
