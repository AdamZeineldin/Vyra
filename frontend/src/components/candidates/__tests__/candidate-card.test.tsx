/** @jest-environment jsdom */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before component imports
// ---------------------------------------------------------------------------

// Mock next/navigation (used transitively)
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/",
}));

// Mock the workspace store — CandidateCard calls setLoadingOverview + reads project
jest.mock("@/stores/workspace-store", () => ({
  useWorkspaceStore: jest.fn(() => ({
    setLoadingOverview: jest.fn(),
    project: { id: "proj-1", name: "Test" },
  })),
}));

// Mock heavy child components that have side effects / external deps
jest.mock("@/components/candidates/file-explorer", () => ({
  FileExplorer: ({ onSelectFile }: { files: unknown; selectedPath?: string; onSelectFile: (p: string) => void }) => (
    <div data-testid="file-explorer" onClick={() => onSelectFile("index.ts")} />
  ),
}));

jest.mock("@/components/candidates/code-preview", () => ({
  CodePreview: ({ content }: { content: string }) => (
    <pre data-testid="code-preview">{content}</pre>
  ),
}));

jest.mock("@/components/candidates/model-chip", () => ({
  ModelChip: ({ modelLabel }: { modelLabel: string }) => (
    <span data-testid="model-chip">{modelLabel}</span>
  ),
}));

jest.mock("@/components/github/github-modal", () => ({
  GitHubModal: () => <div data-testid="github-modal" />,
}));

// Mock fetch used for the AI overview call inside CandidateCard
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ overview: "AI overview text" }),
});

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------

import { CandidateCard } from "@/components/candidates/candidate-card";
import type { Candidate } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "c1",
    versionId: "v1",
    modelId: "claude-sonnet",
    modelLabel: "Claude Sonnet",
    files: {
      "index.ts": {
        path: "index.ts",
        content: "const x = 1; const y = 2; const z = 3; const a = 4; const b = 5; const longLine = 'this is a long line of content for testing excerpt truncation behavior';",
        language: "typescript",
      },
    },
    rawResponse: "",
    execution: null,
    evaluation: null,
    selected: false,
    error: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// describe("CandidateCard forceCollapsed prop")
// ---------------------------------------------------------------------------

describe("CandidateCard forceCollapsed prop", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders in collapsed state when forceCollapsed=true even if isWinner=true", () => {
    const candidate = makeCandidate();
    render(
      <CandidateCard
        candidate={candidate}
        isWinner={true}
        forceCollapsed={true}
      />
    );

    // The model label chip should be visible
    expect(screen.getByTestId("model-chip")).toBeInTheDocument();

    // When forceCollapsed=true, expanded content (file explorer / full AI overview)
    // must NOT be visible. The full expanded section is rendered only when expanded=true.
    expect(screen.queryByTestId("file-explorer")).not.toBeInTheDocument();
  });

  it("shows model label and excerpt when forceCollapsed=true", () => {
    const candidate = makeCandidate();
    render(
      <CandidateCard
        candidate={candidate}
        isWinner={true}
        forceCollapsed={true}
      />
    );

    // Model label must always be visible
    expect(screen.getByTestId("model-chip")).toHaveTextContent("Claude Sonnet");

    // A short code excerpt (CodePreview with maxLines=3) should be present
    // but NOT the expanded full view (file-explorer)
    const codePreview = screen.queryByTestId("code-preview");
    expect(codePreview).toBeInTheDocument();
    expect(screen.queryByTestId("file-explorer")).not.toBeInTheDocument();
  });

  it('"View full output" toggle overrides forceCollapsed for that card', () => {
    const candidate = makeCandidate();
    render(
      <CandidateCard
        candidate={candidate}
        isWinner={false}
        forceCollapsed={true}
      />
    );

    // Initially collapsed — no file explorer
    expect(screen.queryByTestId("file-explorer")).not.toBeInTheDocument();

    // Click "View full output" link inside the card
    const viewFullBtn = screen.getByRole("button", { name: /view full output/i });
    act(() => {
      fireEvent.click(viewFullBtn);
    });

    // After clicking, the card should expand (file explorer visible)
    expect(screen.getByTestId("file-explorer")).toBeInTheDocument();
  });

  it("allows internal expand toggle when forceCollapsed=false", () => {
    const candidate = makeCandidate();
    render(
      <CandidateCard
        candidate={candidate}
        isWinner={false}
        forceCollapsed={false}
      />
    );

    // Initially collapsed (isWinner=false => expanded defaults to false)
    expect(screen.queryByTestId("file-explorer")).not.toBeInTheDocument();

    // The chevron expand button should be present and clickable
    // (it has no accessible name, select by its container or use test-id)
    const expandBtn = screen.getByTestId("expand-toggle");
    act(() => {
      fireEvent.click(expandBtn);
    });

    expect(screen.getByTestId("file-explorer")).toBeInTheDocument();
  });
});
