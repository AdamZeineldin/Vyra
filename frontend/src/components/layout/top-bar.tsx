"use client";

import { Loader2, GitBranch } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface TopBarProps {
  projectName: string;
  hasFiles: boolean;
  hasRepo: boolean;
  onGitHubClick: () => void;
}

export function TopBar({ projectName, hasFiles, hasRepo, onGitHubClick }: TopBarProps) {
  const { isLoadingOverview } = useWorkspaceStore();

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border-tertiary)] rounded-panel">
      <div className="flex items-center gap-2.5">
        <span className="text-[13px] font-medium text-[var(--color-text-primary)] max-w-xs truncate" title={projectName}>
          {projectName}
        </span>
        {isLoadingOverview && (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
            <Loader2 size={12} className="animate-spin" />
            <span>Generating overview…</span>
          </div>
        )}
      </div>

      <button
        onClick={onGitHubClick}
        disabled={!hasFiles}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-btn border border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-fast"
      >
        <GitBranch size={11} />
        {hasRepo ? "Commit to GitHub" : "Export to GitHub"}
      </button>
    </div>
  );
}
