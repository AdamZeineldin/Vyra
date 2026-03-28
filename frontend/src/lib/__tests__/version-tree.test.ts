import {
  buildTree,
  getAncestors,
  getDescendants,
} from "@/lib/version-tree";
import type { Version } from "@/lib/types";
import type { TreeNode } from "@/lib/version-tree";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeVersion(
  id: string,
  parentId: string | null,
  depth: number,
  extra: Partial<Version> = {}
): Version {
  return {
    id,
    projectId: "proj-1",
    parentId,
    prompt: `Prompt for ${id}`,
    selectedCandidateId: null,
    files: {},
    mode: "user",
    depth,
    createdAt: new Date(depth * 1000).toISOString(),
    ...extra,
  } as Version;
}

// A simple linear chain: v1 → v2 → v3
const LINEAR_VERSIONS: Version[] = [
  makeVersion("v1", null, 0),
  makeVersion("v2", "v1", 1),
  makeVersion("v3", "v2", 2),
];

// A branched tree:
//
//   v1
//   ├── v2
//   │   ├── v4
//   │   └── v5
//   └── v3
const BRANCHED_VERSIONS: Version[] = [
  makeVersion("v1", null, 0),
  makeVersion("v2", "v1", 1),
  makeVersion("v3", "v1", 1),
  makeVersion("v4", "v2", 2),
  makeVersion("v5", "v2", 2),
];

// ---------------------------------------------------------------------------
// buildTree
// ---------------------------------------------------------------------------

describe("buildTree", () => {
  describe("happy path", () => {
    it("returns a single root node when given one version", () => {
      const result = buildTree([makeVersion("v1", null, 0)]);
      expect(result).toHaveLength(1);
      expect(result[0].version.id).toBe("v1");
      expect(result[0].children).toHaveLength(0);
      expect(result[0].depth).toBe(0);
    });

    it("builds a linear chain correctly", () => {
      const roots = buildTree(LINEAR_VERSIONS);
      expect(roots).toHaveLength(1);

      const root = roots[0];
      expect(root.version.id).toBe("v1");
      expect(root.depth).toBe(0);
      expect(root.children).toHaveLength(1);

      const child = root.children[0];
      expect(child.version.id).toBe("v2");
      expect(child.depth).toBe(1);
      expect(child.children).toHaveLength(1);

      const grandchild = child.children[0];
      expect(grandchild.version.id).toBe("v3");
      expect(grandchild.depth).toBe(2);
      expect(grandchild.children).toHaveLength(0);
    });

    it("builds a branched tree correctly", () => {
      const roots = buildTree(BRANCHED_VERSIONS);
      expect(roots).toHaveLength(1);

      const root = roots[0];
      expect(root.version.id).toBe("v1");
      // v1 has two children: v2 and v3
      expect(root.children).toHaveLength(2);

      const childIds = root.children.map((c) => c.version.id).sort();
      expect(childIds).toEqual(["v2", "v3"]);

      const v2Node = root.children.find((c) => c.version.id === "v2")!;
      expect(v2Node.children).toHaveLength(2);

      const v3Node = root.children.find((c) => c.version.id === "v3")!;
      expect(v3Node.children).toHaveLength(0);
    });

    it("assigns correct depth to each node", () => {
      const roots = buildTree(BRANCHED_VERSIONS);
      const root = roots[0];

      expect(root.depth).toBe(0);
      root.children.forEach((c) => expect(c.depth).toBe(1));

      const v2 = root.children.find((c) => c.version.id === "v2")!;
      v2.children.forEach((c) => expect(c.depth).toBe(2));
    });

    it("handles multiple disconnected roots", () => {
      const versions: Version[] = [
        makeVersion("r1", null, 0),
        makeVersion("r2", null, 0),
        makeVersion("c1", "r1", 1),
      ];
      const roots = buildTree(versions);
      expect(roots).toHaveLength(2);
      const rootIds = roots.map((r) => r.version.id).sort();
      expect(rootIds).toEqual(["r1", "r2"]);
    });

    it("returns input version objects unchanged (immutability)", () => {
      const original = makeVersion("v1", null, 0);
      const roots = buildTree([original]);
      expect(roots[0].version).toBe(original);
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty input", () => {
      expect(buildTree([])).toEqual([]);
    });

    it("does not mutate the input array", () => {
      const input = [...LINEAR_VERSIONS];
      const originalLength = input.length;
      buildTree(input);
      expect(input).toHaveLength(originalLength);
    });

    it("handles a version whose parentId does not exist (orphan becomes root)", () => {
      const versions: Version[] = [
        makeVersion("v1", null, 0),
        makeVersion("v2", "nonexistent", 1),
      ];
      const roots = buildTree(versions);
      const rootIds = roots.map((r) => r.version.id).sort();
      expect(rootIds).toEqual(["v1", "v2"]);
    });

    it("handles a single version with a null parentId as root", () => {
      const v = makeVersion("only", null, 0);
      const roots = buildTree([v]);
      expect(roots[0].version.id).toBe("only");
      expect(roots[0].depth).toBe(0);
    });

    it("returns new array (does not return the same reference)", () => {
      const input: Version[] = [];
      const result = buildTree(input);
      expect(result).not.toBe(input);
    });
  });
});

// ---------------------------------------------------------------------------
// getAncestors
// ---------------------------------------------------------------------------

describe("getAncestors", () => {
  describe("happy path", () => {
    it("returns empty array for root version", () => {
      expect(getAncestors(LINEAR_VERSIONS, "v1")).toEqual([]);
    });

    it("returns single ancestor for a direct child of root", () => {
      const ancestors = getAncestors(LINEAR_VERSIONS, "v2");
      expect(ancestors).toHaveLength(1);
      expect(ancestors[0].id).toBe("v1");
    });

    it("returns full ancestor chain ordered root → parent for a leaf", () => {
      const ancestors = getAncestors(LINEAR_VERSIONS, "v3");
      expect(ancestors).toHaveLength(2);
      expect(ancestors[0].id).toBe("v1");
      expect(ancestors[1].id).toBe("v2");
    });

    it("returns correct ancestors in branched tree", () => {
      const ancestors = getAncestors(BRANCHED_VERSIONS, "v4");
      expect(ancestors).toHaveLength(2);
      expect(ancestors[0].id).toBe("v1");
      expect(ancestors[1].id).toBe("v2");
    });

    it("path to v3 in branched tree has only root as ancestor", () => {
      const ancestors = getAncestors(BRANCHED_VERSIONS, "v3");
      expect(ancestors).toHaveLength(1);
      expect(ancestors[0].id).toBe("v1");
    });

    it("returns immutable result (does not share references with input)", () => {
      const ancestors = getAncestors(LINEAR_VERSIONS, "v3");
      // Versions themselves are the same objects (immutable read), but the array is new
      expect(ancestors).not.toBe(LINEAR_VERSIONS);
    });
  });

  describe("edge cases", () => {
    it("returns empty array when versionId does not exist", () => {
      expect(getAncestors(LINEAR_VERSIONS, "nonexistent")).toEqual([]);
    });

    it("returns empty array for empty versions list", () => {
      expect(getAncestors([], "v1")).toEqual([]);
    });

    it("handles single-element list with self lookup (root)", () => {
      const single = [makeVersion("v1", null, 0)];
      expect(getAncestors(single, "v1")).toEqual([]);
    });

    it("does not mutate input versions array", () => {
      const input = [...LINEAR_VERSIONS];
      const len = input.length;
      getAncestors(input, "v3");
      expect(input).toHaveLength(len);
    });
  });
});

// ---------------------------------------------------------------------------
// getDescendants
// ---------------------------------------------------------------------------

describe("getDescendants", () => {
  describe("happy path", () => {
    it("returns empty array for a leaf version", () => {
      expect(getDescendants(LINEAR_VERSIONS, "v3")).toEqual([]);
    });

    it("returns direct child for a version with one child", () => {
      const desc = getDescendants(LINEAR_VERSIONS, "v2");
      expect(desc).toHaveLength(1);
      expect(desc[0].id).toBe("v3");
    });

    it("returns all descendants for root (linear chain)", () => {
      const desc = getDescendants(LINEAR_VERSIONS, "v1");
      expect(desc).toHaveLength(2);
      const ids = desc.map((v) => v.id).sort();
      expect(ids).toEqual(["v2", "v3"]);
    });

    it("returns all descendants for root in branched tree", () => {
      const desc = getDescendants(BRANCHED_VERSIONS, "v1");
      expect(desc).toHaveLength(4);
      const ids = desc.map((v) => v.id).sort();
      expect(ids).toEqual(["v2", "v3", "v4", "v5"]);
    });

    it("returns correct descendants for a mid-tree node in branched tree", () => {
      const desc = getDescendants(BRANCHED_VERSIONS, "v2");
      expect(desc).toHaveLength(2);
      const ids = desc.map((v) => v.id).sort();
      expect(ids).toEqual(["v4", "v5"]);
    });

    it("returns empty array for v3 (leaf) in branched tree", () => {
      expect(getDescendants(BRANCHED_VERSIONS, "v3")).toEqual([]);
    });

    it("result is a new array, not the input array", () => {
      const result = getDescendants(LINEAR_VERSIONS, "v1");
      expect(result).not.toBe(LINEAR_VERSIONS);
    });
  });

  describe("edge cases", () => {
    it("returns empty array when versionId does not exist", () => {
      expect(getDescendants(LINEAR_VERSIONS, "nonexistent")).toEqual([]);
    });

    it("returns empty array for empty versions list", () => {
      expect(getDescendants([], "v1")).toEqual([]);
    });

    it("does not include the target version itself", () => {
      const desc = getDescendants(LINEAR_VERSIONS, "v1");
      const ids = desc.map((v) => v.id);
      expect(ids).not.toContain("v1");
    });

    it("does not mutate input array", () => {
      const input = [...LINEAR_VERSIONS];
      const len = input.length;
      getDescendants(input, "v1");
      expect(input).toHaveLength(len);
    });

    it("returns empty array for a version with no children", () => {
      const single = [makeVersion("v1", null, 0)];
      expect(getDescendants(single, "v1")).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// TreeNode interface shape (type-level validation via runtime check)
// ---------------------------------------------------------------------------

describe("TreeNode structure", () => {
  it("each node has version, children, and depth fields", () => {
    const roots = buildTree([makeVersion("v1", null, 0)]);
    const node: TreeNode = roots[0];
    expect(node).toHaveProperty("version");
    expect(node).toHaveProperty("children");
    expect(node).toHaveProperty("depth");
    expect(Array.isArray(node.children)).toBe(true);
    expect(typeof node.depth).toBe("number");
  });

  it("children are TreeNode instances with the same shape", () => {
    const roots = buildTree(LINEAR_VERSIONS);
    const child = roots[0].children[0];
    expect(child).toHaveProperty("version");
    expect(child).toHaveProperty("children");
    expect(child).toHaveProperty("depth");
  });
});
