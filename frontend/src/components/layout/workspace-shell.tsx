"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { shouldAutoCollapse } from "@/lib/collapse-logic";
import { TopBar } from "./top-bar";
import {
  WorkspaceViewport,
  type WorkspaceViewportHandle,
} from "./workspace-viewport";
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
import { saveProjectModels, loadProjectModels } from "@/lib/model-persistence";
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
  const store = useWorkspaceStore();
  const {
    project: storeProject,
    currentVersion,
    candidates,
    selectedCandidateId,
    activeCandidateId,
    activeVersionId,
    evaluationSummary,
    comparisonOverview,
    isLoadingComparison,
    versionHistory,
    candidatesByVersionId,
    selectCandidate,
    evaluateAll,
    fetchComparison,
    isGenerating,
    isEvaluating,
    isExecuting,
    isReverting,
    iterationCount,
    mode,
    error,
  } = store;

  const [selectedModels, setSelectedModels] = useState<ModelConfig[]>(() => {
    const persisted = loadProjectModels(project.id);
    return persisted ?? (project.models as ModelConfig[]);
  });
  const [overridingCandidate, setOverridingCandidate] =
    useState<Candidate | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  // Phase 3: "Continue with this" collapse + prompt pulse
  const [candidatesCollapsed, setCandidatesCollapsed] = useState(false);
  const [shouldPulsePrompt, setShouldPulsePrompt] = useState(false);
  const promptWrapperRef = useRef<HTMLDivElement>(null);
  const viewportHandle = useRef<WorkspaceViewportHandle>(null);
  const prevSelectedRef = useRef<string | null>(null);

  // Re-initialize model selection when the project changes
  useEffect(() => {
    const persisted = loadProjectModels(project.id);
    setSelectedModels(persisted ?? (project.models as ModelConfig[]));
  }, [project.id]);

  // Surface store errors as toasts
  useEffect(() => {
    if (error) setToastError(error);
  }, [error]);

  // Phase 3: Reset collapse when new candidates arrive or version changes
  useEffect(() => {
    setCandidatesCollapsed(false);
    prevSelectedRef.current = null;
  }, [candidates]);

  // Phase 3: Auto-collapse on fresh selection in agent/hybrid mode.
  // prevSelectedRef guards against auto-collapsing when navigating to
  // a historical version that already has a winner.
  useEffect(() => {
    const wasNull = prevSelectedRef.current === null;
    prevSelectedRef.current = selectedCandidateId;
    if (wasNull && shouldAutoCollapse(mode, selectedCandidateId)) {
      setCandidatesCollapsed(true);
    }
  }, [mode, selectedCandidateId]);

  // Compute adjacent versions for the carousel
  const currentIdx = versionHistory.findIndex((v) => v.id === activeVersionId);
  const prevVersion = currentIdx > 0 ? versionHistory[currentIdx - 1] : null;
  const nextVersion =
    currentIdx >= 0 && currentIdx < versionHistory.length - 1
      ? versionHistory[currentIdx + 1]
      : null;

  // Resolve accepted model label for a version (for peek previews)
  const acceptedLabel = (
    versionId: string,
    selectedCandidateIdForVersion: string | null,
  ) => {
    if (!selectedCandidateIdForVersion) return null;
    const vCandidates = candidatesByVersionId[versionId] ?? [];
    return (
      vCandidates.find((c) => c.id === selectedCandidateIdForVersion)
        ?.modelLabel ?? null
    );
  };

  const prevSummary = prevVersion
    ? {
        id: prevVersion.id,
        prompt: prevVersion.prompt,
        acceptedModelLabel: acceptedLabel(
          prevVersion.id,
          prevVersion.selectedCandidateId,
        ),
      }
    : null;

  const nextSummary = nextVersion
    ? {
        id: nextVersion.id,
        prompt: nextVersion.prompt,
        acceptedModelLabel: acceptedLabel(
          nextVersion.id,
          nextVersion.selectedCandidateId,
        ),
      }
    : null;

  const winner = candidates.find((c) => c.id === selectedCandidateId);
  const others = candidates.filter((c) => c.id !== selectedCandidateId);

  const isLoading = isGenerating || isEvaluating || isExecuting;
  const hasResults = candidates.length > 0;
  const needsSelection = hasResults && !selectedCandidateId;

  const handleOverrideConfirm = async (candidateId: string, reason: string) => {
    await selectCandidate(candidateId, reason);
    setOverridingCandidate(null);
  };

  const handleRequestEvaluation = async () => {
    await evaluateAll();
    // Fetch comparison in background after evaluation
    fetchComparison().catch(() => {});
    if (mode === "agent" && evaluationSummary?.bestCandidateId) {
      await selectCandidate(evaluationSummary.bestCandidateId);
    }
  };

  const nextPromptLabel = winner
    ? `NEXT PROMPT — ALL MODELS WILL BUILD FROM ${winner.modelLabel.toUpperCase()}'S OUTPUT`
    : "NEXT PROMPT";

  // Phase 3: Clear pulse when collapse is toggled off
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleContinueWithThis = () => {
    setCandidatesCollapsed(true);
    setShouldPulsePrompt(true);
    if (promptWrapperRef.current && viewportHandle.current) {
      viewportHandle.current.scrollCurrentToElement(promptWrapperRef.current);
    }
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setShouldPulsePrompt(false), 800);
  };

  // Clean up pulse if user expands before timer fires
  useEffect(() => {
    if (!candidatesCollapsed) {
      setShouldPulsePrompt(false);
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
    }
  }, [candidatesCollapsed]);

  return (
    <div className="min-h-screen bg-[var(--color-bg-tertiary)] p-4">
      <div className="max-w-[1080px] mx-auto flex flex-col gap-3">
        <TopBar projectName={storeProject?.name ?? project.name} />

        <div className="flex gap-3 items-start">
          {/* LEFT: workspace carousel viewport */}
          <WorkspaceViewport
            ref={viewportHandle}
            prevVersion={prevSummary}
            nextVersion={nextSummary}
            onSwipePrev={() => store.navigateToAdjacentVersion("prev")}
            onSwipeNext={() => store.navigateToAdjacentVersion("next")}
            disabled={isLoading || isReverting}
          >
            {/* Loading / reverting state */}
            {(isLoading || isReverting) && (
              <div className="vyra-fade-in">
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
                {/* Shimmer skeleton for expected content */}
                {isGenerating && (
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="vyra-shimmer h-24 rounded-panel" />
                    <div className="vyra-shimmer h-24 rounded-panel" />
                  </div>
                )}
              </div>
            )}

            {/* Historical prompt */}
            {!isLoading &&
              !isReverting &&
              hasResults &&
              currentVersion?.prompt && (
                <Panel padding="sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    Prompt
                  </span>
                  <p className="text-[12px] text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                    {currentVersion.prompt}
                  </p>
                </Panel>
              )}

            {/* POST-SELECTION view */}
            {winner && (
              <>
                <div>
                  <SectionHeader>
                    SELECTED OUTPUT — ITERATION {iterationCount}
                  </SectionHeader>
                  <CandidateCard
                    candidate={winner}
                    isWinner
                    isActive={winner.id === activeCandidateId}
                    forceCollapsed={candidatesCollapsed}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleContinueWithThis}
                    >
                      Continue with this
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

                {evaluationSummary && (
                  <EvaluatorPanel
                    summary={evaluationSummary}
                    winner={winner}
                    otherCandidates={others}
                    comparisonOverview={comparisonOverview}
                    isLoadingComparison={isLoadingComparison}
                  />
                )}

                {others.length > 0 && (
                  <div>
                    <SectionHeader>
                      OTHER OUTPUTS — CLICK TO OVERRIDE
                    </SectionHeader>
                    <div className="flex flex-col gap-2">
                      {others.map((c, i) => (
                        <div key={c.id} className={`vyra-slide-up vyra-stagger-${Math.min(i + 1, 5)}`}>
                          <CandidateCard
                            candidate={c}
                            isWinner={false}
                            isActive={c.id === activeCandidateId}
                            showOverride
                            onSelect={() => setOverridingCandidate(c)}
                            forceCollapsed={candidatesCollapsed}
                          />
                        </div>
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
                  {others.map((c, i) => (
                    <div key={c.id} className={`vyra-slide-up vyra-stagger-${Math.min(i + 1, 5)}`}>
                      <CandidateCard
                        candidate={c}
                        isWinner={false}
                        isActive={c.id === activeCandidateId}
                        onSelect={(id) => selectCandidate(id)}
                        highlightIfRecommended={
                          c.id === evaluationSummary?.bestCandidateId
                        }
                      />
                    </div>
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
            <div className="mt-auto">
              {hasResults && <SectionHeader>{nextPromptLabel}</SectionHeader>}
              <div
                ref={promptWrapperRef}
                data-testid="prompt-input-wrapper"
                className={[
                  "rounded-panel transition-shadow duration-300",
                  shouldPulsePrompt
                    ? "ring-2 ring-[var(--color-accent,var(--color-primary-blue))]"
                    : "",
                ].join(" ")}
              >
                <PromptInput
                  modelIds={selectedModels.map((m) => m.id)}
                  currentIteration={iterationCount}
                  onBeforeSend={() =>
                    saveProjectModels(project.id, selectedModels)
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
          </WorkspaceViewport>

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
