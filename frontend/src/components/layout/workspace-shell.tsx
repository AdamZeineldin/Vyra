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
import { IterationPanel } from "@/components/version-tree/iteration-panel";
import type { Candidate, ModelConfig, Project } from "@/lib/types";

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
    project: storeProject,
    candidates,
    selectedCandidateId,
    evaluationSummary,
    selectCandidate,
    evaluateAll,
    isGenerating,
    isEvaluating,
    isExecuting,
    isReverting,
    iterationCount,
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

  const isLoading = isGenerating || isEvaluating || isExecuting;
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
        <TopBar projectName={storeProject?.name ?? project.name} />

        <div className="flex gap-3 items-start">
          {/* LEFT: primary workflow */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {/* Loading / reverting state */}
            {(isLoading || isReverting) && (
              <Panel padding="md">
                <div className="flex items-center gap-2.5 text-[12px] text-[var(--color-text-tertiary)]">
                  <span className="w-4 h-4 rounded-full border-2 border-primary-blue border-t-transparent animate-spin flex-shrink-0" />
                  {isGenerating &&
                    `Generating from ${selectedModels.length} models in parallel…`}
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
                  <SectionHeader>
                    SELECTED OUTPUT — ITERATION {iterationCount}
                  </SectionHeader>
                  <CandidateCard candidate={winner} isWinner />
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
                          showOverride
                          onSelect={() => setOverridingCandidate(c)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* PRE-SELECTION view */}
            {needsSelection && !isLoading && (
              <div>
                <SectionHeader
                  action={
                    mode !== "agent" ? (
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
                  CANDIDATE OUTPUTS — PICK ONE TO CONTINUE
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
                      onSelect={(id) => selectCandidate(id)}
                      highlightIfRecommended={
                        c.id === evaluationSummary?.bestCandidateId
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && !hasResults && (
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
                currentIteration={iterationCount}
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
            <div>
              <SectionHeader>VERSION TREE</SectionHeader>
              <TreeMinimap />
            </div>
            <div>
              <SectionHeader>ITERATIONS</SectionHeader>
              <IterationPanel
                current={iterationCount}
                total={Math.max(iterationCount, 3)}
              />
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
