"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { TopBar } from "./top-bar";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { CandidateCard } from "@/components/candidates/candidate-card";
import { OverrideDialog } from "@/components/candidates/override-dialog";
import { PromptInput } from "@/components/prompt/prompt-input";
import { ModelSelector } from "@/components/prompt/model-selector";
import { EvaluatorPanel } from "@/components/evaluator/evaluator-panel";
import { TreeMinimap } from "@/components/version-tree/tree-minimap";
import type { Candidate, ModelConfig, Project, WorkspaceMode } from "@/lib/types";

const MODES: { id: WorkspaceMode; label: string; description: string }[] = [
  { id: "user",   label: "User",   description: "You pick the winner" },
  { id: "hybrid", label: "Hybrid", description: "AI recommends, you decide" },
  { id: "agent",  label: "Agent",  description: "AI picks automatically" },
];

function ModeSelector() {
  const { mode, setMode } = useWorkspaceStore();
  return (
    <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border-tertiary)] rounded-panel p-2.5">
      <div className="text-[9px] font-semibold tracking-[0.12em] uppercase text-[var(--color-text-tertiary)] mb-2">Mode</div>
      <div className="flex flex-col gap-1">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={[
                "w-full text-left px-2.5 py-2 rounded-btn border transition-colors duration-fast",
                active
                  ? "border-[#6fcf3e] bg-[#6fcf3e12]"
                  : "border-transparent hover:border-[var(--color-border-secondary)] hover:bg-[var(--color-bg-secondary)]",
              ].join(" ")}
            >
              <div className={`text-[11px] font-semibold ${active ? "text-[#6fcf3e]" : "text-[var(--color-text-primary)]"}`}>
                {m.label}
              </div>
              <div className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{m.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SectionHeaderProps {
  children: React.ReactNode;
  action?: React.ReactNode;
}

function SectionHeader({ children, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--color-text-tertiary)]">
        {children}
      </span>
      {action}
    </div>
  );
}

interface WorkspaceShellProps {
  project: Project;
}

export function WorkspaceShell({ project }: WorkspaceShellProps) {
  const {
    currentVersion,
    candidates,
    selectedCandidateId,
    activeCandidateId,
    activeVersionId,
    evaluationSummary,
    selectCandidate,
    evaluateAll,
    isGenerating,
    isEvaluating,
    isExecuting,
    isReverting,
    mode,
    error,
  } = useWorkspaceStore();

  const [selectedModels, setSelectedModels] = useState<ModelConfig[]>(
    project.models as ModelConfig[],
  );
  const [overridingCandidate, setOverridingCandidate] =
    useState<Candidate | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  // Surface store errors as toasts
  useEffect(() => {
    if (error) setToastError(error);
  }, [error]);

  const winner = candidates.find((c) => c.id === selectedCandidateId);
  const others = candidates.filter((c) => c.id !== selectedCandidateId);
  const unselectedCandidates = candidates.filter(() => !selectedCandidateId);

  const isPostGenLoading = isEvaluating || isExecuting; // loading states after generation
  const hasResults = candidates.length > 0;
  const needsSelection = hasResults && !selectedCandidateId;

  const handleOverrideConfirm = async (candidateId: string, reason: string) => {
    await selectCandidate(candidateId, reason);
    setOverridingCandidate(null);
  };

  const handleRequestEvaluation = async () => {
    await evaluateAll();
    if (mode === "agent" && evaluationSummary?.bestCandidateId) {
      await selectCandidate(evaluationSummary.bestCandidateId);
    }
  };

  const nextPromptLabel = winner
    ? `NEXT PROMPT — ALL MODELS WILL BUILD FROM ${winner.modelLabel.toUpperCase()}'S OUTPUT`
    : "NEXT PROMPT";

  return (
    <div className="min-h-screen bg-[var(--color-bg-tertiary)] p-4">
      <div className="max-w-[1080px] mx-auto flex flex-col gap-3">
        <TopBar projectName={currentVersion?.prompt ?? ""} />

        <div className="flex gap-3 items-start">
          {/* LEFT: primary workflow — key triggers fade-in on version switch */}
          <div
            key={activeVersionId ?? "empty"}
            className="flex-1 min-w-0 flex flex-col gap-3 vyra-fade-in"
          >
            {/* Loading state — only for post-gen phases and reverting, not generation itself */}
            {(isPostGenLoading || isReverting) && (
              <Panel padding="md">
                <div className="flex items-center gap-2.5 text-[12px] text-[var(--color-text-tertiary)]">
                  <span className="w-4 h-4 rounded-full border-2 border-primary-blue border-t-transparent animate-spin flex-shrink-0" />
                  {isExecuting && "Running code in sandbox…"}
                  {isReverting && "Loading version…"}
                  {isEvaluating && "Evaluating candidates…"}
                </div>
              </Panel>
            )}

            {/* POST-SELECTION view */}
            {winner && (
              <>
                {/* Selected output */}
                <div>
                  <SectionHeader>SELECTED OUTPUT</SectionHeader>
                  <CandidateCard
                    candidate={winner}
                    isWinner
                    isActive={winner.id === activeCandidateId}
                  />
                  {/* Winner action buttons */}
                  <div className="flex items-center gap-2 mt-2">
                    <Button variant="primary" size="sm" onClick={() => {}}>
                      Continue with this
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => {}}>
                      View full output
                    </Button>
                    <Button
                      variant="warning"
                      size="sm"
                      onClick={() => setOverridingCandidate(others[0] ?? null)}
                      disabled={others.length === 0}
                    >
                      Override pick
                    </Button>
                  </div>
                </div>

                {/* Evaluator analysis */}
                {evaluationSummary && (
                  <>
                    <SectionHeader>WHAT CHANGED — AI ANALYSIS</SectionHeader>
                    <EvaluatorPanel
                      summary={evaluationSummary}
                      winner={winner}
                      otherCandidates={others}
                    />
                  </>
                )}

                {/* Other outputs */}
                {others.length > 0 && (
                  <div>
                    <SectionHeader>
                      OTHER OUTPUTS — CLICK TO OVERRIDE
                    </SectionHeader>
                    <div className="flex flex-col gap-2">
                      {others.map((c) => (
                        <CandidateCard
                          key={c.id}
                          candidate={c}
                          isWinner={false}
                          isActive={c.id === activeCandidateId}
                          showOverride
                          onSelect={() => setOverridingCandidate(c)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* PRE-SELECTION view — shown during streaming and after */}
            {needsSelection && !isPostGenLoading && (
              <div>
                <SectionHeader
                  action={
                    !isGenerating && mode !== "agent" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRequestEvaluation}
                        disabled={isEvaluating}
                      >
                        {isEvaluating ? "Evaluating…" : "Evaluate all"}
                      </Button>
                    ) : undefined
                  }
                >
                  {isGenerating ? "GENERATING…" : "CANDIDATE OUTPUTS — PICK ONE TO CONTINUE"}
                </SectionHeader>

                {evaluationSummary?.bestCandidateId && (
                  <div className="mb-2 px-3 py-2 bg-[var(--color-bg-info)] border border-[var(--color-border-info)] rounded-btn flex items-center justify-between">
                    <span className="text-[11px] text-primary-blue-text">
                      Evaluator recommends:{" "}
                      <span className="font-medium">
                        {
                          candidates.find(
                            (c) => c.id === evaluationSummary.bestCandidateId,
                          )?.modelLabel
                        }
                      </span>
                      <span className="ml-1.5 text-[10px] opacity-70">
                        (confidence:{" "}
                        {Math.round(evaluationSummary.confidence * 100)}%)
                      </span>
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        selectCandidate(evaluationSummary.bestCandidateId!)
                      }
                    >
                      Accept recommendation
                    </Button>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {unselectedCandidates.map((c) => (
                    <CandidateCard
                      key={c.id}
                      candidate={c}
                      isWinner={false}
                      isActive={c.id === activeCandidateId}
                      onSelect={(id) => selectCandidate(id)}
                      highlightIfRecommended={
                        c.id === evaluationSummary?.bestCandidateId
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state — shown only before first generation starts */}
            {!isGenerating && !isPostGenLoading && !hasResults && (
              <Panel padding="md">
                <p className="text-[12px] text-[var(--color-text-tertiary)] text-center py-8">
                  Select models below and submit your first prompt to begin.
                </p>
              </Panel>
            )}

            {/* Next prompt */}
            <div>
              {hasResults && <SectionHeader>{nextPromptLabel}</SectionHeader>}
              <PromptInput
                modelIds={selectedModels.map((m) => m.id)}
                currentVersionLabel={
                  winner ? `${winner.modelLabel} output` : undefined
                }
                modelSelector={
                  <ModelSelector
                    selected={selectedModels}
                    onChange={setSelectedModels}
                  />
                }
              />
            </div>
          </div>

          {/* RIGHT: version tree rail */}
          <div className="w-56 flex-shrink-0 flex flex-col gap-3">
            <ModeSelector />
            <div>
              <SectionHeader>VERSION TREE</SectionHeader>
              <TreeMinimap />
            </div>
          </div>
        </div>
      </div>

      {overridingCandidate && (
        <OverrideDialog
          candidate={overridingCandidate}
          onConfirm={handleOverrideConfirm}
          onCancel={() => setOverridingCandidate(null)}
        />
      )}

      {toastError && (
        <ToastContainer>
          <Toast
            message={toastError}
            variant="error"
            onDismiss={() => setToastError(null)}
          />
        </ToastContainer>
      )}
    </div>
  );
}
