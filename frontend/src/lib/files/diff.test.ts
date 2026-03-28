import { diffFileMaps, diffStats } from "./diff";
import type { FileMap } from "../types";

describe("diffFileMaps", () => {
  it("should detect added files", () => {
    const before: FileMap = {};
    const after: FileMap = {
      "src/index.ts": {
        path: "src/index.ts",
        content: 'console.log("hello");',
        language: "ts",
      },
    };

    const diffs = diffFileMaps(before, after);

    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe("src/index.ts");
    expect(diffs[0].status).toBe("added");
  });

  it("should detect deleted files", () => {
    const before: FileMap = {
      "old.ts": { path: "old.ts", content: "old code", language: "ts" },
    };
    const after: FileMap = {};

    const diffs = diffFileMaps(before, after);

    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe("old.ts");
    expect(diffs[0].status).toBe("deleted");
  });

  it("should detect modified files", () => {
    const before: FileMap = {
      "index.ts": {
        path: "index.ts",
        content: "const x = 1;",
        language: "ts",
      },
    };
    const after: FileMap = {
      "index.ts": {
        path: "index.ts",
        content: "const x = 2;",
        language: "ts",
      },
    };

    const diffs = diffFileMaps(before, after);

    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe("index.ts");
    expect(diffs[0].status).toBe("modified");
    expect(diffs[0].hunks).toContain("-const x = 1;");
    expect(diffs[0].hunks).toContain("+const x = 2;");
  });

  it("should not include unchanged files", () => {
    const fileMap: FileMap = {
      "same.ts": { path: "same.ts", content: "unchanged", language: "ts" },
    };

    const diffs = diffFileMaps(fileMap, fileMap);

    expect(diffs).toHaveLength(0);
  });

  it("should handle mixed changes", () => {
    const before: FileMap = {
      "keep.ts": { path: "keep.ts", content: "keep", language: "ts" },
      "modify.ts": {
        path: "modify.ts",
        content: "old content",
        language: "ts",
      },
      "delete.ts": { path: "delete.ts", content: "gone", language: "ts" },
    };
    const after: FileMap = {
      "keep.ts": { path: "keep.ts", content: "keep", language: "ts" },
      "modify.ts": {
        path: "modify.ts",
        content: "new content",
        language: "ts",
      },
      "add.ts": { path: "add.ts", content: "new file", language: "ts" },
    };

    const diffs = diffFileMaps(before, after);

    expect(diffs).toHaveLength(3);

    const statuses = diffs.map((d) => d.status);
    expect(statuses).toContain("added");
    expect(statuses).toContain("modified");
    expect(statuses).toContain("deleted");
  });
});

describe("diffStats", () => {
  it("should summarize diff results", () => {
    const diffs = [
      { path: "a.ts", status: "added" as const, hunks: "" },
      { path: "b.ts", status: "modified" as const, hunks: "+line\n-line\n" },
      { path: "c.ts", status: "deleted" as const, hunks: "" },
      { path: "d.ts", status: "added" as const, hunks: "" },
    ];

    const stats = diffStats(diffs);

    expect(stats.filesAdded).toBe(2);
    expect(stats.filesModified).toBe(1);
    expect(stats.filesDeleted).toBe(1);
    expect(stats.totalChanges).toBe(4);
  });

  it("should return zeros for empty diffs", () => {
    const stats = diffStats([]);

    expect(stats.filesAdded).toBe(0);
    expect(stats.filesModified).toBe(0);
    expect(stats.filesDeleted).toBe(0);
    expect(stats.totalChanges).toBe(0);
  });
});
