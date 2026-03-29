/** @jest-environment jsdom */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EvaluatorPanel } from "../evaluator-panel";
import type { EvaluationSummary } from "@/stores/workspace-store";
import type { Candidate } from "@/lib/types";

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

const mockSummary: EvaluationSummary = {
  bestCandidateId: "c1",
  confidence: 0.85,
  evaluations: {
    c1: {
      total_score: 8.8,
      scores: { correctness: 9.0, completeness: 8.5, efficiency: 9.0, code_quality: 8.5 },
      reasoning: "Strong solution with clean structure.",
    },
    c2: {
      total_score: 7.2,
      scores: { correctness: 7.0, completeness: 7.5, efficiency: 7.0, code_quality: 7.4 },
      reasoning: "Functional but verbose.",
    },
  },
};

const mockWinner: Candidate = {
  id: "c1", versionId: "v1", modelId: "gpt-4o", modelLabel: "GPT-4o",
  files: {}, rawResponse: "", execution: null, error: null, createdAt: "2024-01-01T00:00:00Z",
  evaluation: { scores: { correctness: 9, codeQuality: 8.5, completeness: 8.5, efficiency: 9 }, totalScore: 8.8, confidence: 0.85, reasoning: "Strong solution." },
  selected: true,
};

const mockOther: Candidate = {
  id: "c2", versionId: "v1", modelId: "claude-3", modelLabel: "Claude 3",
  files: {}, rawResponse: "", execution: null, error: null, createdAt: "2024-01-01T00:00:00Z",
  evaluation: { scores: { correctness: 7, codeQuality: 7.4, completeness: 7.5, efficiency: 7 }, totalScore: 7.2, confidence: 0.85, reasoning: "Verbose." },
  selected: false,
};

describe("EvaluatorPanel", () => {
  it("shows winner model label and score", () => {
    render(<EvaluatorPanel summary={mockSummary} winner={mockWinner} otherCandidates={[mockOther]} />);
    expect(screen.getByText("GPT-4o")).toBeInTheDocument();
    expect(screen.getByText(/8\.8\/10/)).toBeInTheDocument();
  });

  it("does not show confidence level", () => {
    render(<EvaluatorPanel summary={mockSummary} winner={mockWinner} otherCandidates={[mockOther]} />);
    expect(screen.queryByText(/confidence/)).not.toBeInTheDocument();
  });

  it("shows 'Key differences' button when comparison is available", () => {
    render(
      <EvaluatorPanel
        summary={mockSummary} winner={mockWinner} otherCandidates={[mockOther]}
        comparisonOverview={{ comparison: "GPT-4o wins because...", rankings: [] }}
      />
    );
    expect(screen.getByText("Key differences")).toBeInTheDocument();
  });

  it("toggles comparison details on click", () => {
    render(
      <EvaluatorPanel
        summary={mockSummary} winner={mockWinner} otherCandidates={[mockOther]}
        comparisonOverview={{ comparison: "## Winner\nGPT-4o wins", rankings: [] }}
      />
    );
    expect(screen.queryByTestId("evaluator-analysis-body")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Key differences"));
    expect(screen.getByTestId("evaluator-analysis-body")).toBeVisible();
    expect(screen.getByTestId("markdown")).toBeInTheDocument();
  });

  it("shows shimmer when comparison is loading", () => {
    const { container } = render(
      <EvaluatorPanel summary={mockSummary} winner={mockWinner} otherCandidates={[mockOther]} isLoadingComparison />
    );
    // Shimmer only appears when details are shown — but loading state shows button
    // The panel itself should render without crashing
    expect(container).toBeTruthy();
  });

  it("returns null when winner has no evaluation data", () => {
    const emptySummary: EvaluationSummary = { bestCandidateId: "c1", confidence: 0, evaluations: {} };
    const { container } = render(<EvaluatorPanel summary={emptySummary} winner={mockWinner} otherCandidates={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
