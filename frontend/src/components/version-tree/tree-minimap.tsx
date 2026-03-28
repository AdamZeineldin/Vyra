"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { SectionLabel } from "@/components/ui/section-label";
import { Panel } from "@/components/ui/panel";
import { buildTree } from "@/lib/version-tree";
import type { Version } from "@/lib/types";
import type { TreeNode } from "@/lib/version-tree";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_RADIUS = 4; // px — 8px diameter circle
const NODE_SPACING_Y = 24; // vertical gap between levels
const NODE_INDENT_X = 16; // horizontal indent per depth level
const CANVAS_PADDING = 8; // padding inside canvas area

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function Tooltip({
  text,
  x,
  y,
}: {
  text: string;
  x: number;
  y: number;
}) {
  return (
    <div
      className="pointer-events-none absolute z-50 rounded px-1.5 py-0.5 text-[9px] leading-tight whitespace-nowrap"
      style={{
        left: x + NODE_RADIUS + 4,
        top: y - 10,
        background: "var(--color-bg-secondary)",
        border: "1px solid var(--color-border-secondary)",
        color: "var(--color-text-primary)",
      }}
    >
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

interface LayoutNode {
  node: TreeNode;
  x: number;
  y: number;
}

/**
 * Assigns (x, y) coordinates to each node via a simple depth-first traversal.
 * x = depth * NODE_INDENT_X, y increments globally so siblings stack below
 * their parent's subtree.
 */
function layoutTree(
  roots: TreeNode[],
  padding: number
): { items: LayoutNode[]; width: number; height: number } {
  const items: LayoutNode[] = [];
  let rowIndex = 0;

  function visit(node: TreeNode): void {
    const x = padding + node.depth * NODE_INDENT_X;
    const y = padding + rowIndex * NODE_SPACING_Y;
    rowIndex += 1;
    items.push({ node, x, y });
    for (const child of node.children) {
      visit(child);
    }
  }

  for (const root of roots) {
    visit(root);
  }

  const maxX =
    Math.max(...items.map((i) => i.x), 0) + NODE_RADIUS + padding;
  const maxY =
    Math.max(...items.map((i) => i.y), 0) + NODE_RADIUS + padding;

  return { items, width: maxX, height: maxY };
}

// ---------------------------------------------------------------------------
// Single node rendered as an SVG circle
// ---------------------------------------------------------------------------

function VersionNode({
  item,
  isActive,
  isWinner,
  onHover,
  onLeave,
  onClick,
}: {
  item: LayoutNode;
  isActive: boolean;
  isWinner: boolean;
  onHover: (item: LayoutNode) => void;
  onLeave: () => void;
  onClick: (versionId: string) => void;
}) {
  const fill = isActive
    ? "var(--color-primary-blue)"
    : isWinner
    ? "var(--color-winner)"
    : "var(--color-text-tertiary)";

  const strokeWidth = isActive ? 2 : 1;
  const stroke = isActive
    ? "var(--color-primary-blue)"
    : "transparent";

  return (
    <circle
      cx={item.x}
      cy={item.y}
      r={NODE_RADIUS}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={isActive || isWinner ? 1 : 0.5}
      style={{ cursor: "pointer" }}
      onMouseEnter={() => onHover(item)}
      onMouseLeave={onLeave}
      onClick={() => onClick(item.node.version.id)}
    />
  );
}

// ---------------------------------------------------------------------------
// Edge line between parent and child
// ---------------------------------------------------------------------------

function Edge({
  parent,
  child,
}: {
  parent: LayoutNode;
  child: LayoutNode;
}) {
  return (
    <line
      x1={parent.x}
      y1={parent.y}
      x2={child.x}
      y2={child.y}
      stroke="var(--color-border-tertiary)"
      strokeWidth={1}
      opacity={0.6}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TreeMinimap() {
  const { project, activeVersionId, loadVersionTree, revertToVersion } =
    useWorkspaceStore();

  const [versions, setVersions] = useState<Version[]>([]);
  const [hovered, setHovered] = useState<LayoutNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Re-fetch the tree whenever project or current version changes
  useEffect(() => {
    if (!project?.id) return;
    loadVersionTree(project.id).then(setVersions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, activeVersionId]);

  const roots = buildTree(versions);
  const { items, width, height } = layoutTree(roots, CANVAS_PADDING);

  // Build a lookup: parentId → LayoutNode so we can draw edges efficiently
  const itemById = new Map<string, LayoutNode>(
    items.map((i) => [i.node.version.id, i])
  );

  const edges: Array<{ parent: LayoutNode; child: LayoutNode }> = [];
  for (const item of items) {
    const parentId = item.node.version.parentId;
    if (parentId) {
      const parentItem = itemById.get(parentId);
      if (parentItem) {
        edges.push({ parent: parentItem, child: item });
      }
    }
  }

  return (
    <Panel padding="sm">
      <SectionLabel className="mb-2">Version tree</SectionLabel>

      {items.length === 0 ? (
        <div className="text-[10px] text-[var(--color-text-tertiary)] italic">
          No versions yet
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative overflow-auto"
          style={{ maxHeight: "320px" }}
        >
          {/* Tooltip */}
          {hovered && (
            <Tooltip
              text={`#${hovered.node.depth + 1} — ${
                hovered.node.version.prompt.slice(0, 40) || "Initial"
              }${hovered.node.version.prompt.length > 40 ? "…" : ""}`}
              x={hovered.x}
              y={hovered.y}
            />
          )}

          <svg
            width={Math.max(width, 80)}
            height={Math.max(height, 24)}
            style={{ display: "block" }}
          >
            {/* Edges rendered first (behind nodes) */}
            {edges.map(({ parent, child }) => (
              <Edge
                key={`${parent.node.version.id}-${child.node.version.id}`}
                parent={parent}
                child={child}
              />
            ))}

            {/* Nodes */}
            {items.map((item) => (
              <VersionNode
                key={item.node.version.id}
                item={item}
                isActive={item.node.version.id === activeVersionId}
                isWinner={item.node.version.selectedCandidateId !== null}
                onHover={setHovered}
                onLeave={() => setHovered(null)}
                onClick={revertToVersion}
              />
            ))}
          </svg>
        </div>
      )}
    </Panel>
  );
}
