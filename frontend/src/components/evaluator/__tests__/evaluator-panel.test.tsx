/** @jest-environment jsdom */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EvaluatorPanel } from "../evaluator-panel";
import type { EvaluationSummary } from "@/stores/workspace-store";
import type { Candidate } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockSummary: EvaluationSummary = {
  bestCandidateId: "c1",
  confidence: 0.85,
  evaluations: {
    c1: {
      total_score: 88,
      scores: { correctness: 90, codeQuality: 86 },
      reasoning: "Best overall solution",
    },
    c2: {
      total_score: 72,
      scores: { correctness: 70, codeQuality: 74 },
      reasoning: "Good but verbose",
    },
  },
};

const mockWinner: Candidate = {
  id: "c1",
  versionId: "v1",
  modelId: "gpt-4o",
  modelLabel: "GPT-4o",
  files: {},
  rawResponse: "",
  execution: null,
  error: null,
  createdAt: "2024-01-01T00:00:00Z",
  evaluation: {
    scores: { correctness: 90, codeQuality: 86, completeness: 88, efficiency: 88 },
    totalScore: 88,
    confidence: 0.9,
    reasoning: "Best overall",
  },
  selected: true,
};

const mockOther: Candidate = {
  id: "c2",
  versionId: "v1",
  modelId: "claude-3",
  modelLabel: "Claude 3",
  files: {},
  rawResponse: "",
  execution: null,
  error: null,
  createdAt: "2024-01-01T00:00:00Z",
  evaluation: {
    scores: { correctness: 70, codeQuality: 74, completeness: 72, efficiency: 72 },
    totalScore: 72,
    confidence: 0.75,
    reasoning: "Good but verbose",
  },
  selected: false,
};

const mockOtherNoEval: Candidate = {
  id: "c3",
  versionId: "v1",
  modelId: "gemini-pro",
  modelLabel: "Gemini Pro",
  files: {},
  rawResponse: "",
  execution: null,
  error: null,
  createdAt: "2024-01-01T00:00:00Z",
  evaluation: null,
  selected: false,
};

// ---------------------------------------------------------------------------
// describe: collapse / expand
// ---------------------------------------------------------------------------

describe("EvaluatorPanel collapse/expand", () => {
  it("renders full analysis body by default (isCollapsed = false)", () => {
    render(
      <EvaluatorPanel
        summary={mockSummary}
        winner={mockWinner}
        otherCandidates={[mockOther]}
      />
    );
    // Analysis body content is visible - score bars section should exist
    const analysisBody = screen.getByTestId("evaluator-analysis-body");
    expect(analysisBody).toBeVisible();
  });

  it("hides analysis body when chevron toggle is clicked", () => {
    render(
      <EvaluatorPanel
        summary={mockSummary}
        winner={mockWinner}
        otherCandidates={[mockOther]}
      />
    );
    const toggleBtn = screen.getByRole("button", { name: /collapse/i });
    fireEvent.click(toggleBtn);
    const analysisBody = screen.queryByTestId("evaluator-analysis-body");
    expect(analysisBody).not.toBeInTheDocument();
  });

  it("shows analysis body again on second click (toggle back)", () => {
    render(
      <EvaluatorPanel
        summary={mockSummary}
        winner={mockWinner}
        otherCandidates={[mockOther]}
      />
    );
    const toggleBtn = screen.getByRole("button", { name: /collapse/i });
    fireEvent.click(toggleBtn);
    // After first click - collapsed
    expect(screen.queryByTestId("evaluator-analysis-body")).not.toBeInTheDocument();
    // After second click - expanded again
    const expandBtn = screen.getByRole("button", { name: /expand/i });
    fireEvent.click(expandBtn);
    expect(screen.getByTestId("evaluator-analysis-body")).toBeVisible();
  });

  it("chevron button has accessible aria-label in both states", () => {
    render(
      <EvaluatorPanel
        summary={mockSummary}
        winner={mockWinner}
        otherCandidates={[mockOther]}
      />
    );
    // Initially expanded → button label says "Collapse"
    expect(screen.getByRole("button", { name: /collapse/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /collapse/i }));
    // After collapse → button label says "Expand"
    expect(screen.getByRole("button", { name: /expand/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// describe: score bars (candidate-level total_score bars)
// ---------------------------------------------------------------------------

describe("EvaluatorPanel score bars", () => {
  it("renders a score bar row for each candidate with evaluation data", () => {
    render(
      <EvaluatorPanel
        summary={mockSummary}
        winner={mockWinner}
        otherCandidates={[mockOther, mockOtherNoEval]}
      />
    );
    // Two candidates have evaluation data (c1 winner + c2 other)
    const scoreBars = screen.getAllByTestId("candidate-score-bar");
    expect(scoreBars).toHaveLength(2);
  });

  it("score bar width reflects total_score as a percentage", () => {
    render(
      <EvaluatorPanel
        summary={mockSummary}
        winner={mockWinner}
        otherCandidates={[mockOther]}
      />
    );
    // Winner c1 has total_score 88 → bar fill should be 88%
    const winnerFill = screen.getByTestId("candidate-score-bar-fill-c1");
    expect(winnerFill).toHaveStyle({ width: "88%" });
  });

  it("does not render score bar for candidates missing evaluation", () => {
    render(
      <EvaluatorPanel
        summary={mockSummary}
        winner={mockWinner}
        otherCandidates={[mockOtherNoEval]}
      />
    );
    // Only winner (c1) has evaluation; c3 has no evaluation in summary
    const scoreBars = screen.getAllByTestId("candidate-score-bar");
    expect(scoreBars).toHaveLength(1);
  });

  it("winner score bar is visually distinct (has winner label or class)", () => {
    render(
      <EvaluatorPanel
        summary={mockSummary}
        winner={mockWinner}
        otherCandidates={[mockOther]}
      />
    );
    const winnerBar = screen.getByTestId("candidate-score-bar-c1");
    expect(winnerBar).toHaveAttribute("data-winner", "true");
  });
});

// ---------------------------------------------------------------------------
// describe: comparative summary
// ---------------------------------------------------------------------------

describe("EvaluatorPanel comparative summary", () => {
  it("renders a comparative summary sentence mentioning the winner model", () => {
    render(
      <EvaluatorPanel
        summary={mockSummary}
        winner={mockWinner}
        otherCandidates={[mockOther]}
      />
    );
    const summary = screen.getByTestId("comparative-summary");
    expect(summary).toBeInTheDocument();
    expect(summary.textContent).toMatch(/GPT-4o/i);
  });

  it("lists other candidates with their scores", () => {
    render(
      <EvaluatorPanel
        summary={mockSummary}
        winner={mockWinner}
        otherCandidates={[mockOther]}
      />
    );
    const summary = screen.getByTestId("comparative-summary");
    // Claude 3 should appear with its score (72)
    expect(summary.textContent).toMatch(/Claude 3/i);
    expect(summary.textContent).toMatch(/72/);
  });

  it("renders fallback sentence when otherCandidates is empty", () => {
    render(
      <EvaluatorPanel
        summary={{ ...mockSummary, evaluations: { c1: mockSummary.evaluations.c1 } }}
        winner={mockWinner}
        otherCandidates={[]}
      />
    );
    const summary = screen.getByTestId("comparative-summary");
    expect(summary.textContent).toMatch(/GPT-4o was the only candidate evaluated/i);
  });
});
