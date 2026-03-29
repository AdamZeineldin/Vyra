"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, ChevronDown, ChevronUp } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import type { EvaluationSummary, ComparisonOverview } from "@/stores/workspace-store";
import type { Candidate } from "@/lib/types";

interface EvaluatorPanelProps {
  summary: EvaluationSummary;
  winner: Candidate;
  otherCandidates: Candidate[];
  comparisonOverview?: ComparisonOverview | null;
  isLoadingComparison?: boolean;
}

export function EvaluatorPanel({ summary, winner, otherCandidates, comparisonOverview, isLoadingComparison }: EvaluatorPanelProps) {
  const [showDetails, setShowDetails] = useState(false);

  const winnerEval = summary.evaluations[winner.id];
  if (!winnerEval) return null;

  return (
    <Panel padding="sm">
      {/* Single-line verdict */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Bot size={11} className="text-[var(--color-text-info)] flex-shrink-0" />
          <span className="text-[11px] text-[var(--color-text-secondary)] truncate">
            <span className="font-medium text-[var(--color-text-primary)]">{winner.modelLabel}</span>
            {" "}scored {(winnerEval.total_score ?? 0).toFixed(1)}/10
          </span>
        </div>

        {(comparisonOverview?.comparison || isLoadingComparison) && (
          <Button
            variant="ghost" size="sm"
            onClick={() => setShowDetails((s) => !s)}
          >
            {showDetails ? "Hide" : "Key differences"}
            {showDetails ? <ChevronUp size={10} className="ml-0.5" /> : <ChevronDown size={10} className="ml-0.5" />}
          </Button>
        )}
      </div>

      {/* Expandable comparison — only the AI narrative */}
      {showDetails && (
        <div className="mt-2.5 pt-2.5 border-t border-[var(--color-border-tertiary)] vyra-fade-in" data-testid="evaluator-analysis-body">
          {isLoadingComparison && (
            <div className="vyra-shimmer h-12 rounded-btn" />
          )}
          {comparisonOverview?.comparison && (
            <div className="prose-overview text-[11px] text-[var(--color-text-secondary)] leading-relaxed [&_h2]:text-[11px] [&_h2]:font-semibold [&_h2]:text-[var(--color-text-primary)] [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-[11px] [&_h3]:font-medium [&_h3]:text-[var(--color-text-secondary)] [&_h3]:mt-1.5 [&_h3]:mb-0.5 [&_p]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-1.5 [&_li]:mb-0.5 [&_strong]:text-[var(--color-text-primary)]">
              <ReactMarkdown>{comparisonOverview.comparison}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
