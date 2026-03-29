"use client";

import { useState } from "react";
import { Loader2, GitBranch } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { GitHubModal } from "@/components/github/github-modal";
import type { WorkspaceMode } from "@/lib/types";

interface TopBarProps {
  projectName: string;
}

const MODE_CYCLE: WorkspaceMode[] = ["user", "hybrid", "agent"];

const MODE_LABELS: Record<WorkspaceMode, string> = {
  user: "User mode",
  hybrid: "Hybrid mode",
  agent: "Agent mode",
};

function nextMode(current: WorkspaceMode): WorkspaceMode {
  const idx = MODE_CYCLE.indexOf(current);
  return MODE_CYCLE[(idx + 1) % MODE_CYCLE.length];
}

export function TopBar({ projectName }: TopBarProps) {
  const { mode, setMode, isLoadingOverview, project, candidates, selectedCandidateId, currentVersion } =
    useWorkspaceStore();
  const [githubModalOpen, setGithubModalOpen] = useState(false);

  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId);
  const exportFiles = selectedCandidate?.files ?? currentVersion?.files ?? {};
  const hasFiles = Object.keys(exportFiles).length > 0;

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border-tertiary)] rounded-panel">
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
            {projectName}
          </span>
          <button
            onClick={() => setMode(nextMode(mode))}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-pill bg-[#1a2e1a] border border-[#2d5a2d] text-[#4ade80] hover:bg-[#1f361f] transition-colors duration-fast cursor-pointer"
          >
            {MODE_LABELS[mode]}
          </button>
          {isLoadingOverview && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
              <Loader2 size={12} className="animate-spin" />
              <span>Generating overview…</span>
            </div>
          )}
        </div>

        {/* Right side actions */}
        {hasFiles && project && (
          <button
            onClick={() => setGithubModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-btn border border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-primary)] transition-colors duration-fast"
          >
            <GitBranch size={11} />
            Export to GitHub
          </button>
        )}
      </div>

      {githubModalOpen && project && (
        <GitHubModal
          mode="create"
          files={exportFiles}
          projectName={project.name}
          projectId={project.id}
          onClose={() => setGithubModalOpen(false)}
        />
      )}
    </>
  );
}
