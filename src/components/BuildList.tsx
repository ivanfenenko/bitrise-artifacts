import { open } from "@tauri-apps/plugin-shell";
import { Build } from "../types";
import { format, formatDistanceStrict, differenceInMinutes, differenceInHours } from "date-fns";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw, User, CircleCheck, CircleX, Loader2,
  ChevronRight, ChevronDown, Layers, Bookmark,
  CircleSlash, CircleDashed, CirclePause,
  GitBranch, GitCommitHorizontal, Clock, ArrowRight, ExternalLink,
  Filter, Search, X, ChevronsUpDown,
} from "lucide-react";
import { api } from "../api";

type StatusFilter = "all" | "success" | "failed";

interface ContextMenu {
  x: number;
  y: number;
  url: string;
}

interface BuildListProps {
  builds: Build[];
  selectedBuild: Build | null;
  onSelectBuild: (build: Build) => void;
  onRefresh: () => void;
  watchedBranches: string[];
  onAddBranch: (branch: string) => void;
  statusFilter: StatusFilter;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  appSlug?: string;
  activeBranchFilter: string | null;
  onBranchFilter: (branch: string | null) => void;
}

type BuildGroup = { type: "single"; build: Build } | { type: "pipeline"; buildNumber: number; builds: Build[] };

function groupBuilds(builds: Build[]): BuildGroup[] {
  const groups: BuildGroup[] = [];
  const byNumber = new Map<number, Build[]>();

  for (const build of builds) {
    if (build.build_number != null) {
      const existing = byNumber.get(build.build_number);
      if (existing) {
        existing.push(build);
      } else {
        byNumber.set(build.build_number, [build]);
      }
    } else {
      groups.push({ type: "single", build });
    }
  }

  const processed = new Set<number>();
  for (const build of builds) {
    if (build.build_number == null) continue;
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
  if (statuses.some((s) => s === "failed" || s === "error")) return "failed";
  if (statuses.some((s) => s === "running" || s === "in-progress")) return "running";
  if (statuses.some((s) => s === "aborted")) return "aborted";
  if (statuses.every((s) => s === "success")) return "success";
  if (statuses.some((s) => s === "on-hold" || s === "waiting")) return "on-hold";
  return "unknown";
}

function getGroupStatus(group: BuildGroup): string {
  if (group.type === "single") return group.build.status_text?.toLowerCase() || "unknown";
  return computePipelineStatus(group.builds);
}

function matchesStatusFilter(group: BuildGroup, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  const status = getGroupStatus(group);
  if (filter === "success") return status === "success";
  return status === "failed" || status === "error";
}

function getDuration(build: Build): string | null {
  if (!build.triggered_at || !build.finished_at) return null;
  try {
    return formatDistanceStrict(new Date(build.finished_at), new Date(build.triggered_at));
  } catch {
    return null;
  }
}

function shortHash(hash?: string): string | null {
  if (!hash) return null;
  return hash.substring(0, 7);
}

function statusBarColor(status?: string): string {
  switch (status?.toLowerCase()) {
    case "success": return "bg-success";
    case "failed":
    case "error": return "bg-error";
    case "running":
    case "in-progress": return "bg-warning";
    case "aborted": return "bg-zinc-500";
    case "on-hold":
    case "waiting": return "bg-blue-400";
    default: return "bg-zinc-600";
  }
}

export function BuildList({ builds, selectedBuild, onSelectBuild, onRefresh, watchedBranches, onAddBranch, statusFilter, hasMore, loadingMore, onLoadMore, appSlug, activeBranchFilter, onBranchFilter }: BuildListProps) {
  const watchedSet = useMemo(() => new Set(watchedBranches), [watchedBranches]);
  const [expandedPipelines, setExpandedPipelines] = useState<Set<number>>(new Set());
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [allBranches, setAllBranches] = useState<string[]>([]);
  const [branchSearch, setBranchSearch] = useState("");
  const [buildSearch, setBuildSearch] = useState("");
  const [branchesLoading, setBranchesLoading] = useState(false);
  const branchPickerRef = useRef<HTMLDivElement>(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (contextMenu) {
      const handler = () => closeContextMenu();
      document.addEventListener("click", handler);
      return () => document.removeEventListener("click", handler);
    }
  }, [contextMenu, closeContextMenu]);

  // Fetch branches when picker opens
  useEffect(() => {
    if (showBranchPicker && appSlug) {
      setBranchesLoading(true);
      api.getBranches(appSlug)
        .then(setAllBranches)
        .catch(() => setAllBranches([]))
        .finally(() => setBranchesLoading(false));
    }
  }, [showBranchPicker, appSlug]);

  // Close branch picker on outside click
  useEffect(() => {
    if (!showBranchPicker) return;
    const handler = (e: MouseEvent) => {
      if (branchPickerRef.current && !branchPickerRef.current.contains(e.target as Node)) {
        setShowBranchPicker(false);
        setBranchSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showBranchPicker]);

  const filteredBranches = useMemo(() => {
    if (!branchSearch.trim()) return allBranches;
    const q = branchSearch.toLowerCase();
    return allBranches.filter((b) => b.toLowerCase().includes(q));
  }, [allBranches, branchSearch]);

  const groups = useMemo(() => groupBuilds(builds), [builds]);
  const filteredGroups = useMemo(() => {
    const statusFiltered = groups.filter((g) => matchesStatusFilter(g, statusFilter));
    if (!buildSearch.trim()) return statusFiltered;
    const q = buildSearch.toLowerCase();
    return statusFiltered.filter((group) => {
      const buildsToSearch = group.type === "pipeline" ? group.builds : [group.build];
      return buildsToSearch.some((build) => {
        const fields = [
          build.build_number?.toString(),
          build.branch,
          build.triggered_by,
          build.commit_hash,
        ];
        return fields.some((value) => value && value.toLowerCase().includes(q));
      });
    });
  }, [groups, statusFilter, buildSearch]);

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

  const toggleCommitMessage = (buildSlug: string) => {
    setExpandedCommits((prev) => {
      const next = new Set(prev);
      if (next.has(buildSlug)) {
        next.delete(buildSlug);
      } else {
        next.add(buildSlug);
      }
      return next;
    });
  };

  const statusIcon = (icon: React.ReactNode, label: string) => (
    <span className="relative group/status inline-flex">
      {icon}
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2 py-1 rounded bg-zinc-800 text-white text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover/status:opacity-100 transition-opacity z-10">
        {label}
      </span>
    </span>
  );

  const getStatusIcon = (status?: string, size = 16) => {
    const s = status?.toLowerCase();
    switch (s) {
      case "success":
        return statusIcon(<CircleCheck size={size} className="text-success" />, "Success");
      case "failed":
      case "error":
        return statusIcon(<CircleX size={size} className="text-error" />, "Failed");
      case "running":
      case "in-progress":
        return statusIcon(<Loader2 size={size} className="text-warning animate-spin" />, "Running");
      case "aborted":
        return statusIcon(<CircleSlash size={size} className="text-text-muted" />, "Aborted");
      case "on-hold":
      case "waiting":
        return statusIcon(<CirclePause size={size} className="text-blue-400" />, "On Hold");
      default:
        return statusIcon(<CircleDashed size={size} className="text-text-muted" />, status || "Unknown");
    }
  };

  const isSelected = (build: Build) =>
    selectedBuild?.slug != null && build.slug != null && selectedBuild.slug === build.slug;

  const getBitriseUrl = (build: Build): string | null => {
    if (!appSlug || !build.slug) return null;
    return `https://app.bitrise.io/build/${build.slug}`;
  };

  const handleContextMenu = (e: React.MouseEvent, url: string | null) => {
    if (!url) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, url });
  };

  const renderWatchButton = (branch: string) => {
    const isWatched = watchedSet.has(branch);
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!isWatched) {
            onAddBranch(branch);
          }
        }}
        className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors shrink-0 ${
          isWatched
            ? "border-primary/50 bg-primary/10 text-primary cursor-default"
            : "border-border text-text-muted hover:text-primary hover:border-primary/50 hover:bg-primary/10"
        }`}
        title={isWatched ? "Branch is watched" : "Watch this branch"}
      >
        <Bookmark size={14} className={isWatched ? "fill-current" : ""} />
        <span>{isWatched ? "Watched" : "Watch"}</span>
      </button>
    );
  };

  const formatTriggeredAt = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    const minutes = differenceInMinutes(new Date(), date);
    if (minutes < 60) {
      return `${Math.max(1, minutes)}m ago`;
    }
    const hours = differenceInHours(new Date(), date);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    return format(date, "MMM d, yyyy");
  };

  const renderBuildButton = (build: Build, indented: boolean) => {
    const duration = getDuration(build);
    const hash = shortHash(build.commit_hash);
    const bitriseUrl = getBitriseUrl(build);

    return (
      <button
        key={build.slug || Math.random()}
        onClick={() => onSelectBuild(build)}
        onContextMenu={(e) => handleContextMenu(e, bitriseUrl)}
        className={`w-full rounded-lg text-left transition-all border overflow-hidden ${
          indented ? "ml-4 w-[calc(100%-1rem)]" : ""
        } ${
          isSelected(build)
            ? "bg-primary/10 border-primary/50"
            : "bg-surface border-transparent hover:border-border hover:bg-surface-hover"
        }`}
      >
        <div className="flex">
          {/* Status bar */}
          <div className={`w-1 shrink-0 ${statusBarColor(build.status_text)}`} />
          <div className="flex-1 p-3 min-w-0">
            {/* Row 1: status + workflow + build number + date */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {getStatusIcon(build.status_text)}
                <span className="text-sm font-medium text-text-primary truncate">
                  {build.workflow || "Unknown Workflow"}
                </span>
                {build.build_number && (
                  <span className="text-sm font-semibold text-primary">
                    #{build.build_number}
                  </span>
                )}
              </div>
              <span className="text-xs text-text-muted shrink-0">
                {formatTriggeredAt(build.triggered_at)}
              </span>
            </div>

            {/* Row 2: Branch and User info - PROMINENT */}
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              {!indented && build.branch && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-hover">
                  <GitBranch size={14} className="text-primary shrink-0" />
                  <span className="text-sm font-medium text-text-primary truncate">{build.branch}</span>
                  {build.pull_request_target_branch && (
                    <>
                      <ArrowRight size={12} className="text-text-muted shrink-0" />
                      <span className="text-sm text-text-secondary truncate">{build.pull_request_target_branch}</span>
                    </>
                  )}
                </div>
              )}
              {(build.triggered_by || build.pull_request_author) && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-hover">
                  <User size={14} className="text-primary shrink-0" />
                  <span className="text-sm font-medium text-text-primary">
                    {build.pull_request_author || build.triggered_by}
                  </span>
                </div>
              )}
            </div>

            {/* Row 3: commit message */}
            {!!build.commit_message && !indented && (
              <div className="mt-2 ml-6 pl-2 border-l-2 border-border">
                <div className="flex items-start gap-2">
                  <p className={`text-sm text-text-secondary leading-relaxed flex-1 ${
                    expandedCommits.has(build.slug || '') ? '' : 'line-clamp-2'
                  }`}>
                    {build.commit_message}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCommitMessage(build.slug || '');
                    }}
                    className="shrink-0 p-0.5 rounded hover:bg-surface-hover text-text-muted hover:text-primary transition-colors"
                    title={expandedCommits.has(build.slug || '') ? "Collapse" : "Expand"}
                  >
                    <ChevronsUpDown size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Row 4: metadata chips */}
            {(build.pull_request_id || hash || duration) && (
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                {!!build.pull_request_id && (
                  <span className="text-xs text-text-muted">PR #{build.pull_request_id}</span>
                )}
                {!!hash && (
                  <div className="flex items-center gap-1">
                    <GitCommitHorizontal size={12} className="text-text-muted" />
                    <span className="text-xs font-mono text-text-muted">{hash}</span>
                  </div>
                )}
                {!!duration && (
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-text-muted" />
                    <span className="text-xs text-text-muted">{duration}</span>
                  </div>
                )}
              </div>
            )}

            {/* Watch button for standalone builds */}
            {!indented && build.branch && !watchedSet.has(build.branch) && (
              <div className="mt-2">
                {renderWatchButton(build.branch)}
              </div>
            )}
          </div>
        </div>
      </button>
    );
  };

  const renderPipelineGroup = (group: BuildGroup & { type: "pipeline" }) => {
    const expanded = expandedPipelines.has(group.buildNumber);
    const first = group.builds[0];
    const status = computePipelineStatus(group.builds);
    const hasSelectedChild = group.builds.some(isSelected);
    const duration = getDuration(first);
    const hash = shortHash(first.commit_hash);

    return (
      <div key={`pipeline-${group.buildNumber}`}>
        <div
          className={`rounded-lg border overflow-hidden transition-all ${
            hasSelectedChild && !expanded
              ? "bg-primary/10 border-primary/50"
              : "bg-surface border-transparent hover:border-border hover:bg-surface-hover"
          }`}
        >
          <button
            onClick={() => togglePipeline(group.buildNumber)}
            className="w-full text-left"
          >
            <div className="flex">
              {/* Status bar */}
              <div className={`w-1 shrink-0 ${statusBarColor(status)}`} />
              <div className="flex-1 p-3 min-w-0">
                {/* Row 1: expand + status + build number + workflow count + watch button + date */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {expanded
                      ? <ChevronDown size={16} className="text-text-muted shrink-0" />
                      : <ChevronRight size={16} className="text-text-muted shrink-0" />}
                    {getStatusIcon(status)}
                    <span className="text-base font-bold text-primary">
                      #{group.buildNumber}
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-surface-hover text-text-secondary">
                      <Layers size={11} />
                      {group.builds.length}
                    </span>
                    {!activeBranchFilter && first.branch && renderWatchButton(first.branch)}
                  </div>
                  <span className="text-xs text-text-muted shrink-0">
                    {formatTriggeredAt(first.triggered_at)}
                  </span>
                </div>

                {/* Row 2: Branch and User info - PROMINENT */}
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  {first.branch && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-hover">
                      <GitBranch size={14} className="text-primary shrink-0" />
                      <span className="text-sm font-medium text-text-primary truncate">{first.branch}</span>
                      {first.pull_request_target_branch && (
                        <>
                          <ArrowRight size={12} className="text-text-muted shrink-0" />
                          <span className="text-sm text-text-secondary truncate">{first.pull_request_target_branch}</span>
                        </>
                      )}
                    </div>
                  )}
                  {(first.triggered_by || first.pull_request_author) && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-hover">
                      <User size={14} className="text-primary shrink-0" />
                      <span className="text-sm font-medium text-text-primary">
                        {first.pull_request_author || first.triggered_by}
                      </span>
                    </div>
                  )}
                </div>

                {/* Row 3: commit message */}
                {!!first.commit_message && (
                  <div className="mt-2 ml-6 pl-2 border-l-2 border-border">
                    <div className="flex items-start gap-2">
                      <p className={`text-sm text-text-secondary leading-relaxed flex-1 ${
                        expandedCommits.has(`pipeline-${group.buildNumber}`) ? '' : 'line-clamp-2'
                      }`}>
                        {first.commit_message}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCommitMessage(`pipeline-${group.buildNumber}`);
                        }}
                        className="shrink-0 p-0.5 rounded hover:bg-surface-hover text-text-muted hover:text-primary transition-colors"
                        title={expandedCommits.has(`pipeline-${group.buildNumber}`) ? "Collapse" : "Expand"}
                      >
                        <ChevronsUpDown size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Row 4: metadata */}
                {(first.pull_request_id || hash || duration) && (
                  <div className="mt-2 flex items-center gap-3 flex-wrap">
                    {!!first.pull_request_id && (
                      <span className="text-xs text-text-muted">PR #{first.pull_request_id}</span>
                    )}
                    {!!hash && (
                      <div className="flex items-center gap-1">
                        <GitCommitHorizontal size={12} className="text-text-muted" />
                        <span className="text-xs font-mono text-text-muted">{hash}</span>
                      </div>
                    )}
                    {!!duration && (
                      <div className="flex items-center gap-1">
                        <Clock size={12} className="text-text-muted" />
                        <span className="text-xs text-text-muted">{duration}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Expanded child workflows */}
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
      <div className="h-14 border-b border-border px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-text-primary">Builds</h2>
          {activeBranchFilter && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
              <GitBranch size={12} />
              <span className="max-w-[150px] truncate">{activeBranchFilter}</span>
              <button
                onClick={() => onBranchFilter(null)}
                className="p-0.5 rounded hover:bg-primary/20 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={buildSearch}
              onChange={(e) => setBuildSearch(e.target.value)}
              placeholder="Search builds..."
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-md text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary"
            />
            {buildSearch && (
              <button
                onClick={() => setBuildSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="relative" ref={branchPickerRef}>
            <button
              onClick={() => setShowBranchPicker(!showBranchPicker)}
              className={`p-2 rounded-lg transition-colors ${
                showBranchPicker || activeBranchFilter
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-surface-hover text-text-secondary"
              }`}
              title="Filter by branch"
            >
              <Filter size={18} />
            </button>
            {showBranchPicker && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-surface border border-border rounded-lg shadow-xl z-50 flex flex-col max-h-80">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="text"
                      value={branchSearch}
                      onChange={(e) => setBranchSearch(e.target.value)}
                      placeholder="Search branches..."
                      className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-md text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {branchesLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 size={18} className="animate-spin text-primary" />
                    </div>
                  ) : filteredBranches.length === 0 ? (
                    <div className="py-4 text-center text-xs text-text-muted">
                      {branchSearch ? "No branches match" : "No branches found"}
                    </div>
                  ) : (
                    <div className="py-1">
                      {/* Show all option when a filter is active */}
                      {activeBranchFilter && (
                        <button
                          onClick={() => {
                            onBranchFilter(null);
                            setShowBranchPicker(false);
                            setBranchSearch("");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover transition-colors"
                        >
                          <span className="font-medium">All branches</span>
                        </button>
                      )}
                      {filteredBranches.map((branch) => (
                        <button
                          key={branch}
                          onClick={() => {
                            onBranchFilter(branch);
                            setShowBranchPicker(false);
                            setBranchSearch("");
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                            activeBranchFilter === branch
                              ? "bg-primary/10 text-primary"
                              : "text-text-secondary hover:bg-surface-hover"
                          }`}
                        >
                          <GitBranch size={14} className="shrink-0" />
                          <span className="truncate">{branch}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            title="Refresh builds"
          >
            <RefreshCw size={18} className="text-text-secondary" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {builds.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            <p>Select an app to view builds</p>
          </div>
        ) : (
          <div className="p-2">
            <div className="space-y-1.5">
              {filteredGroups.map((group) =>
                group.type === "single"
                  ? renderBuildButton(group.build, false)
                  : renderPipelineGroup(group)
              )}
            </div>
            {hasMore && (
              <div className="py-3 flex justify-center">
                <button
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              open(contextMenu.url);
              closeContextMenu();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors"
          >
            <ExternalLink size={14} />
            Open in Bitrise
          </button>
        </div>
      )}
    </div>
  );
}
