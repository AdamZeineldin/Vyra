import type { Version } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TreeNode {
  readonly version: Version;
  readonly children: TreeNode[];
  readonly depth: number;
}

// ---------------------------------------------------------------------------
// buildTree
//
// Takes a flat list of Version objects and returns the forest of TreeNodes
// (typically a single root, but supports multiple disconnected roots).
// Versions whose parentId is null, or whose parentId is not present in the
// list, are treated as roots.
//
// Immutability guarantee: input array is never mutated.
// ---------------------------------------------------------------------------

export function buildTree(versions: readonly Version[]): TreeNode[] {
  // Map id → Version for O(1) parent look-ups
  const byId = new Map<string, Version>(versions.map((v) => [v.id, v]));

  // We build nodes bottom-up by creating a mutable staging map first,
  // then freeze into read-only TreeNode objects.
  const nodeMap = new Map<string, TreeNode>();

  // First pass: create a shell node for every version
  for (const v of versions) {
    const node: TreeNode = { version: v, children: [], depth: v.depth };
    nodeMap.set(v.id, node);
  }

  // Second pass: wire children into parents
  const roots: TreeNode[] = [];

  for (const v of versions) {
    const node = nodeMap.get(v.id)!;
    const parentExists = v.parentId !== null && byId.has(v.parentId);

    if (!parentExists) {
      roots.push(node);
    } else {
      const parentNode = nodeMap.get(v.parentId!)!;
      // parentNode.children is the mutable array we created above
      (parentNode.children as TreeNode[]).push(node);
    }
  }

  return roots;
}

// ---------------------------------------------------------------------------
// getAncestors
//
// Returns the path from the root down to (but not including) the given
// version, ordered [root, ..., directParent].
//
// Returns [] if:
//   - versionId is not in versions
//   - versionId refers to a root (parentId === null or parent not found)
//   - versions is empty
// ---------------------------------------------------------------------------

export function getAncestors(
  versions: readonly Version[],
  versionId: string
): Version[] {
  const byId = new Map<string, Version>(versions.map((v) => [v.id, v]));

  const target = byId.get(versionId);
  if (!target) return [];

  const chain: Version[] = [];
  let currentParentId = target.parentId;

  while (currentParentId !== null && byId.has(currentParentId)) {
    const parent = byId.get(currentParentId)!;
    chain.unshift(parent); // prepend so result is root → parent order
    currentParentId = parent.parentId;
  }

  return chain;
}

// ---------------------------------------------------------------------------
// getDescendants
//
// Returns ALL versions that descend from the given version (any depth),
// excluding the version itself. Order is breadth-first but not guaranteed
// to callers — treat as a set.
//
// Returns [] if:
//   - versionId is not in versions
//   - versionId is a leaf
//   - versions is empty
// ---------------------------------------------------------------------------

export function getDescendants(
  versions: readonly Version[],
  versionId: string
): Version[] {
  // Build a parentId → children index
  const childrenOf = new Map<string, Version[]>();
  for (const v of versions) {
    if (v.parentId !== null) {
      const existing = childrenOf.get(v.parentId) ?? [];
      childrenOf.set(v.parentId, [...existing, v]);
    }
  }

  const result: Version[] = [];
  const queue: string[] = [versionId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = childrenOf.get(current) ?? [];
    for (const child of children) {
      result.push(child);
      queue.push(child.id);
    }
  }

  return result;
}
