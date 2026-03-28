"use client";

import { useWorkspaceStore } from "@/stores/workspace-store";
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
  const { mode, setMode } = useWorkspaceStore();

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border-tertiary)] rounded-panel">
      <div className="flex items-center gap-2.5">
        <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
          {projectName}
        </span>
        <button
          onClick={() => setMode(nextMode(mode))}
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-pill bg-[var(--color-bg-info)] border border-[var(--color-border-info)] text-[var(--color-text-info)] hover:bg-primary-blue-bg transition-colors duration-fast cursor-pointer"
        >
          {MODE_LABELS[mode]}
        </button>
      </div>
    </div>
  );
}
