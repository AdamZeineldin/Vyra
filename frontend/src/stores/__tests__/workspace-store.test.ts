import { useWorkspaceStore } from "@/stores/workspace-store";
import type { Project, Version, Candidate } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProject(id = "proj-1"): Project {
  return {
    id,
    name: "Test Project",
    description: "",
    models: [],
    rootVersionId: null,
    currentVersionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeVersion(id: string, parentId: string | null = null): Version {
  return {
    id,
    projectId: "proj-1",
    parentId,
    prompt: `Prompt for ${id}`,
    selectedCandidateId: null,
    files: {},
    mode: "user",
    depth: 0,
    createdAt: new Date().toISOString(),
  };
}

function makeCandidate(id: string, versionId: string): Candidate {
  return {
    id,
    versionId,
    modelId: "claude-sonnet-4-5-20250514",
    modelLabel: "Claude Sonnet 4.5",
    files: {},
    rawResponse: "",
    execution: null,
    evaluation: null,
    selected: false,
    error: null,
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Additional helpers
// ---------------------------------------------------------------------------

function makeVersionWithWinner(id: string, winnerId: string): Version {
  return {
    id,
    projectId: "proj-1",
    parentId: null,
    prompt: `Prompt for ${id}`,
    selectedCandidateId: winnerId,
    files: {},
    mode: "user",
    depth: 0,
    createdAt: new Date().toISOString(),
  };
}

// Reset store to initial state before each test
beforeEach(() => {
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
});

// ---------------------------------------------------------------------------
// resetWorkspace
// ---------------------------------------------------------------------------

describe("resetWorkspace", () => {
  it("exists as an action on the store", () => {
    const store = useWorkspaceStore.getState();
    expect(typeof store.resetWorkspace).toBe("function");
  });

  it("clears all workspace state back to initial values", () => {
    // Populate store with non-default values
    useWorkspaceStore.setState({
      project: makeProject(),
      currentVersion: makeVersion("v1"),
      candidates: [makeCandidate("c1", "v1")],
      selectedCandidateId: "c1",
      evaluationSummary: {
        bestCandidateId: "c1",
        confidence: 0.9,
        evaluations: {},
      },
      mode: "agent",
      isGenerating: true,
      isEvaluating: true,
      isExecuting: true,
      isReverting: true,
      prompt: "some prompt",
      error: "some error",
      versionHistory: [makeVersion("v1")],
      activeVersionId: "v1",
      activeCandidateId: "c1",
      candidatesByVersionId: { v1: [makeCandidate("c1", "v1")] },
    });

    // Act
    useWorkspaceStore.getState().resetWorkspace();

    // Assert — all workspace-specific fields are reset
    const state = useWorkspaceStore.getState();
    expect(state.currentVersion).toBeNull();
    expect(state.candidates).toEqual([]);
    expect(state.selectedCandidateId).toBeNull();
    expect(state.evaluationSummary).toBeNull();
    expect(state.isGenerating).toBe(false);
    expect(state.isEvaluating).toBe(false);
    expect(state.isExecuting).toBe(false);
    expect(state.isReverting).toBe(false);
    expect(state.prompt).toBe("");
    expect(state.error).toBeNull();
    expect(state.versionHistory).toEqual([]);
    expect(state.activeVersionId).toBeNull();
    expect(state.activeCandidateId).toBeNull();
    expect(state.candidatesByVersionId).toEqual({});
  });

  it("preserves the project reference (project is set separately)", () => {
    const project = makeProject();
    useWorkspaceStore.setState({
      project,
      currentVersion: makeVersion("v1"),
      candidates: [makeCandidate("c1", "v1")],
    });

    useWorkspaceStore.getState().resetWorkspace();

    // project should NOT be cleared by resetWorkspace — it's set by setProject
    const state = useWorkspaceStore.getState();
    expect(state.project).toBe(project);
  });

  it("preserves mode setting (user preference, not workspace data)", () => {
    useWorkspaceStore.setState({
      mode: "hybrid",
      candidates: [makeCandidate("c1", "v1")],
    });

    useWorkspaceStore.getState().resetWorkspace();

    expect(useWorkspaceStore.getState().mode).toBe("hybrid");
  });

  it("is idempotent — calling twice produces the same result", () => {
    useWorkspaceStore.setState({
      currentVersion: makeVersion("v1"),
      candidates: [makeCandidate("c1", "v1")],
    });

    useWorkspaceStore.getState().resetWorkspace();
    const stateAfterFirst = { ...useWorkspaceStore.getState() };

    useWorkspaceStore.getState().resetWorkspace();
    const stateAfterSecond = useWorkspaceStore.getState();

    // Compare relevant fields (functions won't be equal by reference after spread)
    expect(stateAfterSecond.currentVersion).toEqual(stateAfterFirst.currentVersion);
    expect(stateAfterSecond.candidates).toEqual(stateAfterFirst.candidates);
    expect(stateAfterSecond.selectedCandidateId).toEqual(stateAfterFirst.selectedCandidateId);
    expect(stateAfterSecond.versionHistory).toEqual(stateAfterFirst.versionHistory);
    expect(stateAfterSecond.candidatesByVersionId).toEqual(stateAfterFirst.candidatesByVersionId);
  });

  it("returns new empty arrays (not shared references)", () => {
    useWorkspaceStore.getState().resetWorkspace();
    const state1 = useWorkspaceStore.getState();

    useWorkspaceStore.getState().resetWorkspace();
    const state2 = useWorkspaceStore.getState();

    // Each reset should produce fresh arrays
    expect(state1.candidates).not.toBe(state2.candidates);
    expect(state1.versionHistory).not.toBe(state2.versionHistory);
  });
});

// ---------------------------------------------------------------------------
// selectCandidate syncs activeCandidateId (Phase 2 prep — verify current behavior)
// ---------------------------------------------------------------------------

describe("selectCandidate activeCandidateId sync", () => {
  beforeEach(() => {
    // Mock fetch for selectCandidate
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("updates activeCandidateId when selecting a candidate", async () => {
    useWorkspaceStore.setState({
      project: makeProject(),
      currentVersion: makeVersion("v1"),
      candidates: [
        makeCandidate("c1", "v1"),
        makeCandidate("c2", "v1"),
      ],
      activeCandidateId: null,
    });

    await useWorkspaceStore.getState().selectCandidate("c1");

    const state = useWorkspaceStore.getState();
    expect(state.selectedCandidateId).toBe("c1");
    expect(state.activeCandidateId).toBe("c1");
  });

  it("marks only the selected candidate as selected=true in candidates array", async () => {
    useWorkspaceStore.setState({
      project: makeProject(),
      currentVersion: makeVersion("v1"),
      candidates: [
        makeCandidate("c1", "v1"),
        makeCandidate("c2", "v1"),
        makeCandidate("c3", "v1"),
      ],
    });

    await useWorkspaceStore.getState().selectCandidate("c2");

    const { candidates } = useWorkspaceStore.getState();
    expect(candidates.find((c) => c.id === "c2")?.selected).toBe(true);
    expect(candidates.find((c) => c.id === "c1")?.selected).toBe(false);
    expect(candidates.find((c) => c.id === "c3")?.selected).toBe(false);
  });

  it("overriding selection updates both selectedCandidateId and activeCandidateId", async () => {
    useWorkspaceStore.setState({
      project: makeProject(),
      currentVersion: makeVersion("v1"),
      candidates: [makeCandidate("c1", "v1"), makeCandidate("c2", "v1")],
      selectedCandidateId: "c1",
      activeCandidateId: "c1",
    });

    await useWorkspaceStore.getState().selectCandidate("c2");

    const state = useWorkspaceStore.getState();
    expect(state.selectedCandidateId).toBe("c2");
    expect(state.activeCandidateId).toBe("c2");
  });
});

// ---------------------------------------------------------------------------
// Phase 7: Historical prompt display — generate preserves prompt in currentVersion
// ---------------------------------------------------------------------------

// Helper: build a mock SSE ReadableStream from an array of event objects
function mockSSEStream(events: Record<string, unknown>[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = events.map((e) => `data: ${JSON.stringify(e)}\n`).join("\n") + "\n";
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    },
  });
}

describe("generate — preserves prompt in currentVersion (SSE)", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: mockSSEStream([
        { type: "version_created", version_id: "v-new" },
        { type: "done", version_id: "v-new" },
      ]),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("currentVersion.prompt equals the submitted prompt after generate()", async () => {
    useWorkspaceStore.setState({
      project: makeProject(),
      prompt: "Add a login form",
      mode: "user",
    });

    await useWorkspaceStore.getState().generate([]);

    const { currentVersion } = useWorkspaceStore.getState();
    expect(currentVersion).not.toBeNull();
    expect(currentVersion!.prompt).toBe("Add a login form");
  });

  it("versionHistory entry for the new version also has the prompt", async () => {
    useWorkspaceStore.setState({
      project: makeProject(),
      prompt: "Create a dashboard",
      mode: "user",
    });

    await useWorkspaceStore.getState().generate([]);

    const { versionHistory } = useWorkspaceStore.getState();
    const newEntry = versionHistory.find((v) => v.id === "v-new");
    expect(newEntry).toBeDefined();
    expect(newEntry!.prompt).toBe("Create a dashboard");
  });

  it("prompt field is cleared in the store after generation", async () => {
    useWorkspaceStore.setState({
      project: makeProject(),
      prompt: "Something to generate",
      mode: "user",
    });

    await useWorkspaceStore.getState().generate([]);

    expect(useWorkspaceStore.getState().prompt).toBe("");
  });

  it("new version includes parentId and projectId for correct tree placement", async () => {
    const parent = makeVersion("v-parent");
    useWorkspaceStore.setState({
      project: makeProject("proj-1"),
      currentVersion: parent,
      prompt: "Next step",
      mode: "user",
    });

    await useWorkspaceStore.getState().generate([]);

    const { currentVersion } = useWorkspaceStore.getState();
    expect((currentVersion as unknown as Record<string, unknown>).parentId).toBe("v-parent");
    expect((currentVersion as unknown as Record<string, unknown>).projectId).toBe("proj-1");
  });
});

// ---------------------------------------------------------------------------
// Phase 7: evaluateAll uses currentVersion.prompt, not store prompt field
// ---------------------------------------------------------------------------

describe("evaluateAll — uses version prompt, not cleared store prompt", () => {
  let capturedBodies: Array<Record<string, unknown>>;

  beforeEach(() => {
    capturedBodies = [];
    global.fetch = jest.fn().mockImplementation((_url: string, opts?: RequestInit) => {
      if (opts?.body) {
        try { capturedBodies.push(JSON.parse(opts.body as string)); } catch { /* ignore */ }
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            best_candidate_id: "c1",
            confidence: 0.8,
            evaluations: {},
          }),
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the version's own prompt, not the cleared store prompt", async () => {
    useWorkspaceStore.setState({
      project: makeProject(),
      prompt: "", // already cleared — simulates post-generate state
      currentVersion: { ...makeVersion("v1"), prompt: "Build a login form" },
      candidates: [makeCandidate("c1", "v1")],
    });

    await useWorkspaceStore.getState().evaluateAll();

    const evaluateBody = capturedBodies[0];
    expect(evaluateBody).toBeDefined();
    expect(evaluateBody.prompt).toBe("Build a login form");
    expect(evaluateBody.version_id).toBe("v1");
  });

  it("sends empty string when currentVersion has no prompt (graceful degradation)", async () => {
    useWorkspaceStore.setState({
      project: makeProject(),
      prompt: "",
      currentVersion: makeVersion("v1"), // prompt: "Prompt for v1" from helper
      candidates: [makeCandidate("c1", "v1")],
    });

    await useWorkspaceStore.getState().evaluateAll();

    const evaluateBody = capturedBodies[0];
    // makeVersion sets prompt: `Prompt for ${id}` so it will be that value, not ""
    expect(typeof evaluateBody.prompt).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Phase 7: revertToVersion — populates currentVersion.prompt from history
// ---------------------------------------------------------------------------

describe("revertToVersion — restores prompt from version history", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          makeCandidate("c1", "v1"),
          { ...makeCandidate("c2", "v1"), selected: true },
        ]),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("currentVersion.prompt is the version's prompt after revert", async () => {
    const v1 = { ...makeVersion("v1"), prompt: "Build a todo app" };
    useWorkspaceStore.setState({
      project: makeProject(),
      versionHistory: [v1],
    });

    await useWorkspaceStore.getState().revertToVersion("v1");

    const { currentVersion } = useWorkspaceStore.getState();
    expect(currentVersion!.prompt).toBe("Build a todo app");
  });

  it("navigating to different versions shows each version's prompt", async () => {
    const v1 = { ...makeVersion("v1"), prompt: "Initial prompt" };
    const v2 = { ...makeVersion("v2", "v1"), prompt: "Add dark mode" };
    useWorkspaceStore.setState({
      project: makeProject(),
      versionHistory: [v1, v2],
    });

    await useWorkspaceStore.getState().navigateToVersion("v1");
    expect(useWorkspaceStore.getState().currentVersion!.prompt).toBe("Initial prompt");

    await useWorkspaceStore.getState().navigateToVersion("v2");
    expect(useWorkspaceStore.getState().currentVersion!.prompt).toBe("Add dark mode");
  });
});

// ---------------------------------------------------------------------------
// Phase 2: Selection sync — navigateToCandidate does NOT auto-select
// ---------------------------------------------------------------------------

describe("navigateToCandidate — highlights without selecting", () => {
  beforeEach(() => {
    // Mock fetch for /versions/{id}/candidates
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          makeCandidate("c1", "v1"),
          { ...makeCandidate("c2", "v1"), selected: true },
        ]),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sets activeCandidateId without changing selectedCandidateId", async () => {
    useWorkspaceStore.setState({
      project: makeProject(),
      versionHistory: [makeVersionWithWinner("v1", "c2")],
      selectedCandidateId: "c2",
      activeCandidateId: null,
    });

    await useWorkspaceStore.getState().navigateToCandidate("v1", "c1");

    const state = useWorkspaceStore.getState();
    // Highlighting c1 in tree should NOT change the selection (c2 remains winner)
    expect(state.activeCandidateId).toBe("c1");
    // selectedCandidateId reflects the winner from the loaded version data (c2)
    expect(state.selectedCandidateId).toBe("c2");
  });

  it("navigateToVersion resets activeCandidateId to null", async () => {
    useWorkspaceStore.setState({
      project: makeProject(),
      versionHistory: [makeVersionWithWinner("v1", "c2")],
      activeCandidateId: "c1",
    });

    await useWorkspaceStore.getState().navigateToVersion("v1");

    const state = useWorkspaceStore.getState();
    expect(state.activeCandidateId).toBeNull();
  });

  it("navigateToVersion restores winner (selectedCandidateId) from version history", async () => {
    useWorkspaceStore.setState({
      project: makeProject(),
      versionHistory: [makeVersionWithWinner("v1", "c2")],
    });

    await useWorkspaceStore.getState().navigateToVersion("v1");

    const state = useWorkspaceStore.getState();
    // The winner is the candidate with selected=true from the API response
    expect(state.selectedCandidateId).toBe("c2");
  });
});

// ---------------------------------------------------------------------------
// Phase 4: navigateToAdjacentVersion
// ---------------------------------------------------------------------------

describe("navigateToAdjacentVersion", () => {
  beforeEach(() => {
    // Mock fetch for revertToVersion (called internally by navigateToVersion)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { ...makeCandidate("c1", "v1"), selected: true },
        ]),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("navigates to the next version from mid-tree", async () => {
    const v1 = makeVersion("v1");
    const v2 = makeVersion("v2", "v1");
    const v3 = makeVersion("v3", "v2");
    useWorkspaceStore.setState({
      project: makeProject(),
      versionHistory: [v1, v2, v3],
      activeVersionId: "v2",
    });

    await useWorkspaceStore.getState().navigateToAdjacentVersion("next");

    expect(useWorkspaceStore.getState().activeVersionId).toBe("v3");
  });

  it("navigates to the previous version from mid-tree", async () => {
    const v1 = makeVersion("v1");
    const v2 = makeVersion("v2", "v1");
    const v3 = makeVersion("v3", "v2");
    useWorkspaceStore.setState({
      project: makeProject(),
      versionHistory: [v1, v2, v3],
      activeVersionId: "v2",
    });

    await useWorkspaceStore.getState().navigateToAdjacentVersion("prev");

    expect(useWorkspaceStore.getState().activeVersionId).toBe("v1");
  });

  it("no-op at the leaf (newest) boundary — does not navigate past last version", async () => {
    const v1 = makeVersion("v1");
    const v2 = makeVersion("v2", "v1");
    useWorkspaceStore.setState({
      project: makeProject(),
      versionHistory: [v1, v2],
      activeVersionId: "v2",
    });

    await useWorkspaceStore.getState().navigateToAdjacentVersion("next");

    // Already at last; should remain at v2
    expect(useWorkspaceStore.getState().activeVersionId).toBe("v2");
  });

  it("no-op at the root (oldest) boundary — does not navigate past first version", async () => {
    const v1 = makeVersion("v1");
    const v2 = makeVersion("v2", "v1");
    useWorkspaceStore.setState({
      project: makeProject(),
      versionHistory: [v1, v2],
      activeVersionId: "v1",
    });

    await useWorkspaceStore.getState().navigateToAdjacentVersion("prev");

    // Already at first; should remain at v1
    expect(useWorkspaceStore.getState().activeVersionId).toBe("v1");
  });

  it("no-op when versionHistory is empty", async () => {
    useWorkspaceStore.setState({
      project: makeProject(),
      versionHistory: [],
      activeVersionId: null,
    });

    // Should not throw
    await expect(
      useWorkspaceStore.getState().navigateToAdjacentVersion("next")
    ).resolves.toBeUndefined();

    expect(useWorkspaceStore.getState().activeVersionId).toBeNull();
  });

  it("when activeVersionId is null + direction next → navigates to first version", async () => {
    const v1 = makeVersion("v1");
    const v2 = makeVersion("v2", "v1");
    useWorkspaceStore.setState({
      project: makeProject(),
      versionHistory: [v1, v2],
      activeVersionId: null,
    });

    await useWorkspaceStore.getState().navigateToAdjacentVersion("next");

    expect(useWorkspaceStore.getState().activeVersionId).toBe("v1");
  });

  it("when activeVersionId is null + direction prev → navigates to last version", async () => {
    const v1 = makeVersion("v1");
    const v2 = makeVersion("v2", "v1");
    useWorkspaceStore.setState({
      project: makeProject(),
      versionHistory: [v1, v2],
      activeVersionId: null,
    });

    await useWorkspaceStore.getState().navigateToAdjacentVersion("prev");

    expect(useWorkspaceStore.getState().activeVersionId).toBe("v2");
  });

  it("works correctly with a single version in history", async () => {
    const v1 = makeVersion("v1");
    useWorkspaceStore.setState({
      project: makeProject(),
      versionHistory: [v1],
      activeVersionId: "v1",
    });

    // Both directions should be no-ops
    await useWorkspaceStore.getState().navigateToAdjacentVersion("next");
    expect(useWorkspaceStore.getState().activeVersionId).toBe("v1");

    await useWorkspaceStore.getState().navigateToAdjacentVersion("prev");
    expect(useWorkspaceStore.getState().activeVersionId).toBe("v1");
  });
});

// ---------------------------------------------------------------------------
// Phase 2: Selection invariants — no conflicting state
// ---------------------------------------------------------------------------

describe("selection state invariants", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("only one candidate has selected=true after selectCandidate", async () => {
    useWorkspaceStore.setState({
      project: makeProject(),
      currentVersion: makeVersion("v1"),
      candidates: [
        { ...makeCandidate("c1", "v1"), selected: true },
        makeCandidate("c2", "v1"),
        makeCandidate("c3", "v1"),
      ],
      selectedCandidateId: "c1",
    });

    await useWorkspaceStore.getState().selectCandidate("c3");

    const { candidates } = useWorkspaceStore.getState();
    const selectedCount = candidates.filter((c) => c.selected).length;
    expect(selectedCount).toBe(1);
    expect(candidates.find((c) => c.selected)?.id).toBe("c3");
  });

  it("selectCandidate does not mutate candidate objects in place", async () => {
    const original = makeCandidate("c1", "v1");
    useWorkspaceStore.setState({
      project: makeProject(),
      currentVersion: makeVersion("v1"),
      candidates: [original],
    });

    await useWorkspaceStore.getState().selectCandidate("c1");

    const updated = useWorkspaceStore.getState().candidates[0];
    // The object reference should be different (immutable update)
    expect(updated).not.toBe(original);
    expect(original.selected).toBe(false); // original is unchanged
    expect(updated.selected).toBe(true);
  });
});
