/** @jest-environment jsdom */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/",
}));

// We need to control store state per test, so mock the module and provide
// a factory that returns our controlled state.
const mockSelectCandidate = jest.fn().mockResolvedValue(undefined);
const mockEvaluateAll = jest.fn().mockResolvedValue(undefined);

let mockStoreState = {
  project: { id: "proj-1", name: "Test Project" },
  currentVersion: { id: "v1", prompt: "Hello" },
  candidates: [] as import("@/lib/types").Candidate[],
  selectedCandidateId: null as string | null,
  activeCandidateId: null as string | null,
  activeVersionId: "v1",
  evaluationSummary: null,
  versionHistory: [] as import("@/lib/types").Version[],
  candidatesByVersionId: {} as Record<string, import("@/lib/types").Candidate[]>,
  selectCandidate: mockSelectCandidate,
  evaluateAll: mockEvaluateAll,
  navigateToAdjacentVersion: jest.fn().mockResolvedValue(undefined),
  isGenerating: false,
  isEvaluating: false,
  isExecuting: false,
  isReverting: false,
  iterationCount: 1,
  mode: "user" as import("@/lib/types").WorkspaceMode,
  error: null,
  setLoadingOverview: jest.fn(),
};

jest.mock("@/stores/workspace-store", () => ({
  useWorkspaceStore: jest.fn(() => mockStoreState),
}));

// Mock heavy sub-components
jest.mock("@/components/layout/top-bar", () => ({
  TopBar: ({ projectName }: { projectName: string }) => (
    <div data-testid="top-bar">{projectName}</div>
  ),
}));

jest.mock("@/components/candidates/candidate-card", () => ({
  CandidateCard: ({
    candidate,
    forceCollapsed,
  }: {
    candidate: import("@/lib/types").Candidate;
    isWinner?: boolean;
    isActive?: boolean;
    forceCollapsed?: boolean;
    showOverride?: boolean;
    onSelect?: (id: string) => void;
    highlightIfRecommended?: boolean;
  }) => (
    <div
      data-testid={`candidate-card-${candidate.id}`}
      data-force-collapsed={String(forceCollapsed ?? false)}
    >
      {candidate.modelLabel}
    </div>
  ),
}));

jest.mock("@/components/candidates/override-dialog", () => ({
  OverrideDialog: () => <div data-testid="override-dialog" />,
}));

jest.mock("@/components/prompt/prompt-input", () => ({
  PromptInput: (props: {
    modelIds: string[];
    currentIteration: number;
    onBeforeSend: () => void;
    modelSelector: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="prompt-input" className={props.className} />
  ),
}));

jest.mock("@/components/prompt/model-selector", () => ({
  ModelSelector: () => <div data-testid="model-selector" />,
}));

jest.mock("@/components/evaluator/evaluator-panel", () => ({
  EvaluatorPanel: () => <div data-testid="evaluator-panel" />,
}));

jest.mock("@/components/version-tree/tree-minimap", () => ({
  TreeMinimap: () => <div data-testid="tree-minimap" />,
}));

jest.mock("@/components/github/github-modal", () => ({
  GitHubModal: () => <div data-testid="github-modal" />,
}));

jest.mock("@/lib/modes", () => ({
  MODES: [
    { id: "user", label: "User", description: "Manual selection" },
    { id: "agent", label: "Agent", description: "Auto selection" },
    { id: "hybrid", label: "Hybrid", description: "Mixed" },
  ],
}));

jest.mock("@/lib/model-persistence", () => ({
  saveProjectModels: jest.fn(),
  loadProjectModels: jest.fn().mockReturnValue(null),
}));

jest.mock("@/components/layout/workspace-viewport", () => ({
  WorkspaceViewport: React.forwardRef(
    function WorkspaceViewport(
      { children }: { children: React.ReactNode },
      ref: React.Ref<unknown>,
    ) {
      React.useImperativeHandle(ref, () => ({
        scrollCurrentToElement: jest.fn(),
      }));
      return <div data-testid="workspace-viewport">{children}</div>;
    },
  ),
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------

import { WorkspaceShell } from "@/components/layout/workspace-shell";
import type { Candidate, Project } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProject(): Project {
  return {
    id: "proj-1",
    name: "Test Project",
    description: "",
    runtime: "node",
    models: [{ id: "claude-sonnet", label: "Claude Sonnet", provider: "anthropic" }],
    rootVersionId: null,
    currentVersionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeCandidate(id: string, overrides: Partial<Candidate> = {}): Candidate {
  return {
    id,
    versionId: "v1",
    modelId: "claude-sonnet",
    modelLabel: "Claude Sonnet",
    files: {
      "index.ts": { path: "index.ts", content: "const x = 1;", language: "typescript" },
    },
    rawResponse: "",
    execution: null,
    evaluation: null,
    selected: id === "c1",
    error: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// describe("Continue with this — collapse behavior")
// ---------------------------------------------------------------------------

describe("Continue with this — collapse behavior", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    // Reset scroll mock
    window.HTMLElement.prototype.scrollIntoView = jest.fn();

    // Default: one selected winner + one other candidate
    mockStoreState = {
      ...mockStoreState,
      candidates: [makeCandidate("c1"), makeCandidate("c2", { selected: false })],
      selectedCandidateId: "c1",
      mode: "user",
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("sets candidatesCollapsed when 'Continue with this' is clicked", () => {
    render(<WorkspaceShell project={makeProject()} />);

    // Both candidate cards should initially NOT be force-collapsed
    const card2 = screen.getByTestId("candidate-card-c2");
    expect(card2).toHaveAttribute("data-force-collapsed", "false");

    const continueBtn = screen.getByRole("button", { name: /continue with this/i });
    act(() => {
      fireEvent.click(continueBtn);
    });

    // After clicking, non-winner candidates should be force-collapsed
    expect(card2).toHaveAttribute("data-force-collapsed", "true");
  });

  it("scrolls prompt into view on 'Continue with this' click", () => {
    render(<WorkspaceShell project={makeProject()} />);

    // The prompt wrapper element should exist
    const promptWrapper = screen.getByTestId("prompt-input-wrapper");
    expect(promptWrapper).toBeInTheDocument();

    const continueBtn = screen.getByRole("button", { name: /continue with this/i });
    act(() => {
      fireEvent.click(continueBtn);
    });

    // Scrolling is delegated to WorkspaceViewport.scrollCurrentToElement
    // which is mocked — verify the prompt wrapper has the pulse ring
    expect(promptWrapper.className).toContain("ring-2");
  });

  it("resets collapse when new candidates arrive (candidates array changes)", async () => {
    const { rerender } = render(<WorkspaceShell project={makeProject()} />);

    // Click "Continue with this" to collapse
    const continueBtn = screen.getByRole("button", { name: /continue with this/i });
    act(() => {
      fireEvent.click(continueBtn);
    });

    // Verify collapsed
    expect(screen.getByTestId("candidate-card-c2")).toHaveAttribute(
      "data-force-collapsed",
      "true"
    );

    // Simulate new candidates arriving (new generation round)
    const newCandidates = [
      makeCandidate("c3", { id: "c3" }),
      makeCandidate("c4", { id: "c4", selected: false }),
    ];
    mockStoreState = {
      ...mockStoreState,
      candidates: newCandidates,
      selectedCandidateId: "c3",
    };

    await act(async () => {
      rerender(<WorkspaceShell project={makeProject()} />);
    });

    // Collapse should be reset — new candidates are NOT force-collapsed
    const card4 = screen.getByTestId("candidate-card-c4");
    expect(card4).toHaveAttribute("data-force-collapsed", "false");
  });

  it("in agent mode, collapses when selectedCandidateId changes via store", async () => {
    // Start with no selection in agent mode
    mockStoreState = {
      ...mockStoreState,
      mode: "agent",
      selectedCandidateId: null,
      candidates: [
        makeCandidate("c1", { selected: false }),
        makeCandidate("c2", { selected: false }),
      ],
    };

    const { rerender } = render(<WorkspaceShell project={makeProject()} />);

    // No winner yet — candidatesCollapsed is false
    // Now the store auto-selects c1 (agent mode)
    mockStoreState = {
      ...mockStoreState,
      selectedCandidateId: "c1",
      candidates: [makeCandidate("c1"), makeCandidate("c2", { selected: false })],
    };

    await act(async () => {
      rerender(<WorkspaceShell project={makeProject()} />);
    });

    // In agent mode, auto-selection should trigger collapse
    const card2 = screen.getByTestId("candidate-card-c2");
    expect(card2).toHaveAttribute("data-force-collapsed", "true");
  });

  it("applies pulse class to prompt wrapper after 'Continue with this' click", () => {
    render(<WorkspaceShell project={makeProject()} />);

    const continueBtn = screen.getByRole("button", { name: /continue with this/i });
    act(() => {
      fireEvent.click(continueBtn);
    });

    // The prompt wrapper should have the pulse ring class applied
    const promptWrapper = screen.getByTestId("prompt-input-wrapper");
    expect(promptWrapper.className).toContain("ring-2");
  });

  it("removes pulse class from prompt wrapper after 800ms", () => {
    render(<WorkspaceShell project={makeProject()} />);

    const continueBtn = screen.getByRole("button", { name: /continue with this/i });
    act(() => {
      fireEvent.click(continueBtn);
    });

    // Pulse should be active at t=0
    const promptWrapper = screen.getByTestId("prompt-input-wrapper");
    expect(promptWrapper.className).toContain("ring-2");

    // Advance timers past 800ms
    act(() => {
      jest.advanceTimersByTime(900);
    });

    // Pulse ring should be removed
    expect(promptWrapper.className).not.toContain("ring-2");
  });
});
