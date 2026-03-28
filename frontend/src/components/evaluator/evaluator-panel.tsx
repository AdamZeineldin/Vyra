"use client";

import { CheckCircle2, AlertTriangle, MinusCircle, Bot } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import type { EvaluationSummary } from "@/stores/workspace-store";
import type { Candidate } from "@/lib/types";

interface DiffRowProps {
  icon: "plus" | "warn" | "minus";
  text: string;
}

function DiffRow({ icon, text }: DiffRowProps) {
  const config = {
    plus: {
      bg: "bg-diff-add-bg",
      text: "text-diff-add-text",
      Icon: CheckCircle2,
    },
    warn: {
      bg: "bg-diff-warn-bg",
      text: "text-diff-warn-text",
      Icon: AlertTriangle,
    },
    minus: {
      bg: "bg-diff-del-bg",
      text: "text-diff-del-text",
      Icon: MinusCircle,
    },
  }[icon];

  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className={`w-5 h-5 rounded-node flex items-center justify-center flex-shrink-0 ${config.bg}`}>
        <config.Icon size={11} className={config.text} />
      </div>
      <p className={`text-[11px] leading-relaxed ${config.text}`}>{text}</p>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 10) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--color-text-tertiary)] w-24 flex-shrink-0 capitalize">
        {label.replace(/_/g, " ")}
      </span>
      <div className="flex-1 h-1 bg-[var(--color-bg-secondary)] rounded-pill overflow-hidden">
        <div
          className="h-full bg-primary-blue rounded-pill transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-[var(--color-text-tertiary)] w-6 text-right">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);

  const colorClass =
    confidence >= 0.7
      ? "bg-green-500"
      : confidence >= 0.4
      ? "bg-yellow-400"
      : "bg-red-500";

  const label =
    confidence >= 0.7
      ? "High confidence"
      : confidence >= 0.4
      ? "Moderate confidence"
      : "Low confidence";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-[var(--color-bg-secondary)] rounded-pill overflow-hidden">
        <div
          className={`h-full rounded-pill transition-all duration-300 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-[var(--color-text-tertiary)] whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

interface EvaluatorPanelProps {
  summary: EvaluationSummary;
  winner: Candidate;
  otherCandidates: Candidate[];
}

export function EvaluatorPanel({ summary, winner, otherCandidates }: EvaluatorPanelProps) {
  const winnerEval = summary.evaluations[winner.id];

  if (!winnerEval) return null;

  // Build diff rows from reasoning + comparison
  const diffRows: DiffRowProps[] = [];

  const reasoning = winnerEval.reasoning;
  if (reasoning.includes("Executes successfully")) {
    diffRows.push({ icon: "plus", text: `${winner.modelLabel}: Executes without errors` });
  }
  if (reasoning.includes("addresses the prompt well")) {
    diffRows.push({ icon: "plus", text: "Prompt intent clearly fulfilled" });
  }
  if (reasoning.includes("minimal regression")) {
    diffRows.push({ icon: "plus", text: "Minimal regression — additive changes only" });
  }

  // Compare against runners-up
  for (const other of otherCandidates.slice(0, 2)) {
    const otherEval = summary.evaluations[other.id];
    if (!otherEval) continue;
    const gap = winnerEval.total_score - otherEval.total_score;
    if (gap > 0) {
      diffRows.push({
        icon: "warn",
        text: `${other.modelLabel} scored ${otherEval.total_score.toFixed(1)} vs ${winnerEval.total_score.toFixed(1)} — ${gap.toFixed(1)} pt gap`,
      });
    }
  }

  if (reasoning.includes("significant code churn")) {
    diffRows.push({ icon: "minus", text: "Significant code churn detected in this candidate" });
  }

  return (
    <Panel padding="md">
      {/* "AI picked" banner shown when a winner has been auto-selected */}
      {summary.bestCandidateId && (
        <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 rounded-node bg-[var(--color-bg-info)] border border-[var(--color-border-info)]">
          <Bot size={11} className="text-[var(--color-text-info)] flex-shrink-0" />
          <span className="text-[11px] text-[var(--color-text-info)] font-medium">
            AI picked {winner.modelLabel}
          </span>
        </div>
      )}

      {/* Confidence progress bar */}
      <div className="mb-3">
        <ConfidenceBar confidence={summary.confidence} />
      </div>

      {/* Score bars */}
      <div className="flex flex-col gap-1.5 mb-3 pb-3 border-b border-[var(--color-border-tertiary)]">
        {Object.entries(winnerEval.scores).map(([key, val]) => (
          <ScoreBar key={key} label={key} value={val as number} />
        ))}
      </div>

      {/* Diff rows */}
      <div className="flex flex-col divide-y divide-[var(--color-border-tertiary)]">
        {diffRows.map((row, i) => (
          <DiffRow key={i} {...row} />
        ))}
        {diffRows.length === 0 && (
          <p className="text-[11px] text-[var(--color-text-tertiary)] italic py-1">
            {reasoning}
          </p>
        )}
      </div>
    </Panel>
  );
}
