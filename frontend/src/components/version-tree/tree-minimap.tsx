"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { SectionLabel } from "@/components/ui/section-label";
import { Panel } from "@/components/ui/panel";
import { buildTree } from "@/lib/version-tree";
import { getModelTreePillStyle } from "@/lib/model-colors";
import type { TreeNode } from "@/lib/version-tree";
import type { Candidate, Version } from "@/lib/types";

// ---------------------------------------------------------------------------
// Candidate row — a single model output entry under a prompt node
// ---------------------------------------------------------------------------

function CandidateRow({
  candidate,
  isLast,
  isWinner,
  isActive,
  onNavigate,
}: {
  candidate: Candidate;
  isLast: boolean;
  isWinner: boolean;
  isActive: boolean;
  onNavigate: (candidateId: string) => void;
}) {
  // Pill style: winner=green, active=blue, normal=brand color
  const pillStyle = isActive
    ? "bg-[var(--color-primary-blue)]/15 text-[var(--color-primary-blue)] border border-[var(--color-primary-blue)]/50"
    : isWinner
    ? "bg-[var(--color-winner)]/15 text-[var(--color-winner)] border border-[var(--color-winner)]/40"
    : getModelTreePillStyle(candidate.modelId ?? "");

  return (
    <button
      onClick={() => onNavigate(candidate.id)}
      className="flex items-center gap-1 w-full text-left py-0.5 transition-all duration-150 cursor-pointer group"
    >
      {/* Tree connector */}
      <span className="font-mono text-[var(--color-border-secondary)] select-none w-3 shrink-0 opacity-60 text-[10px]">
        {isLast ? "└" : "├"}
      </span>

      {/* Color-coded pill */}
      <span
        className={[
          "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium",
          "transition-all duration-150",
          pillStyle,
          !isWinner && !isActive ? "opacity-60 group-hover:opacity-90" : "",
        ].join(" ")}
      >
        <span className="truncate max-w-[80px]">{candidate.modelLabel}</span>
        {isWinner && <span className="shrink-0">✓</span>}
        {isActive && <span className="shrink-0">←</span>}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Shared props passed down through the recursive tree
// ---------------------------------------------------------------------------

interface TreeContext {
  candidatesByVersionId: Record<string, Candidate[]>;
  promptNumberMap: Map<string, number>;
  activeVersionId: string | null;
  activeCandidateId: string | null;
  onNavigateVersion: (versionId: string) => void;
  onNavigateCandidate: (versionId: string, candidateId: string) => void;
}

// ---------------------------------------------------------------------------
// Version node — one prompt row with its candidate children, then child versions
// ---------------------------------------------------------------------------

const DEPTH_INDENT_PX = 10;

function VersionNode({
  node,
  ctx,
}: {
  node: TreeNode;
  ctx: TreeContext;
}) {
  const {
    candidatesByVersionId,
    promptNumberMap,
    activeVersionId,
    activeCandidateId,
    onNavigateVersion,
    onNavigateCandidate,
  } = ctx;

  const isActiveVersion = node.version.id === activeVersionId;
  const candidates = candidatesByVersionId[node.version.id] ?? [];
  const promptNumber = promptNumberMap.get(node.version.id) ?? node.depth + 1;
  const leftPad = node.depth * DEPTH_INDENT_PX;

  return (
    <div style={{ paddingLeft: leftPad }}>
      {/* Prompt pill */}
      <button
        onClick={() => onNavigateVersion(node.version.id)}
        title={node.version.prompt || "Initial version"}
        className={[
          "w-full text-left px-2 py-1 rounded text-[10px] font-medium mb-0.5",
          "transition-all duration-200 cursor-pointer truncate block",
          isActiveVersion
            ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
            : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
        ].join(" ")}
      >
        Prompt {promptNumber}
      </button>

      {/* Candidate rows */}
      {candidates.length > 0 && (
        <div className="pl-2 mb-1">
          {candidates.map((c, i) => (
            <CandidateRow
              key={c.id}
              candidate={c}
              isLast={i === candidates.length - 1}
              isWinner={c.id === node.version.selectedCandidateId}
              isActive={isActiveVersion && c.id === activeCandidateId}
              onNavigate={(candidateId) =>
                onNavigateCandidate(node.version.id, candidateId)
              }
            />
          ))}
        </div>
      )}

      {/* Recurse into child versions */}
      {node.children.map((child) => (
        <VersionNode key={child.version.id} node={child} ctx={ctx} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function TreeMinimap() {
  const {
    project,
    activeVersionId,
    activeCandidateId,
    versionHistory,
    candidatesByVersionId,
    loadVersionTree,
    navigateToVersion,
    navigateToCandidate,
  } = useWorkspaceStore();

  const [versions, setVersions] = useState<Version[]>([]);

  useEffect(() => {
    if (!project?.id) return;
    loadVersionTree(project.id).then(setVersions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, activeVersionId]);

  const roots = buildTree(versions);

  // Stable prompt number (1-based) derived from creation-order history
  const promptNumberMap = new Map<string, number>(
    versionHistory.map((v, i) => [v.id, i + 1])
  );

  const ctx: TreeContext = {
    candidatesByVersionId,
    promptNumberMap,
    activeVersionId,
    activeCandidateId,
    onNavigateVersion: navigateToVersion,
    onNavigateCandidate: navigateToCandidate,
  };

  return (
    <Panel padding="sm">
      <SectionLabel className="mb-2">Version tree</SectionLabel>

      {versions.length === 0 ? (
        <div className="text-[10px] text-[var(--color-text-tertiary)] italic">
          No versions yet
        </div>
      ) : (
        <div className="overflow-auto" style={{ maxHeight: "360px" }}>
          {roots.map((root) => (
            <VersionNode key={root.version.id} node={root} ctx={ctx} />
          ))}
        </div>
      )}
    </Panel>
  );
}
