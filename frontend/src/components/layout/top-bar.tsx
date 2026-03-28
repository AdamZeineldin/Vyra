"use client";

import Image from "next/image";
import { UserCircle, Plus, Settings } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { WorkspaceMode } from "@/lib/types";

interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

function IconButton({ icon, label, onClick }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="w-7 h-7 flex items-center justify-center rounded-btn border border-[var(--color-border-tertiary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors duration-fast"
    >
      {icon}
    </button>
  );
}

interface TopBarProps {
  projectName: string;
  onToggleTree?: () => void;
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

export function TopBar({ projectName, onToggleTree }: TopBarProps) {
  const { mode, setMode } = useWorkspaceStore();

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border-tertiary)] rounded-panel">
      {/* Left: Vyra logo + project name + mode pill */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Vyra"
            width={24}
            height={24}
            className="rounded-sm flex-shrink-0"
          />
          <span className="text-[11px] font-semibold tracking-wide text-[var(--color-text-tertiary)] uppercase">
            Vyra
          </span>
        </div>
        <span className="text-[var(--color-border-secondary)]">·</span>
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

      {/* Right: icon controls */}
      <div className="flex items-center gap-1.5">
        <IconButton icon={<UserCircle size={13} />} label="Profile" />
        <IconButton icon={<Plus size={13} />} label="New project" onClick={onToggleTree} />
        <IconButton icon={<Settings size={13} />} label="Settings" />
      </div>
    </div>
  );
}
