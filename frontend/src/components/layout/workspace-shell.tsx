"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
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
import { GitHubModal } from "@/components/github/github-modal";
import { IterationPanel } from "@/components/version-tree/iteration-panel";
import { saveProjectModels, loadProjectModels } from "@/lib/model-persistence";
import type { Candidate, ModelConfig, Project } from "@/lib/types";
import { MODES } from "@/lib/modes";

function ModeSelector() {
  const { mode, setMode } = useWorkspaceStore();
  const [open, setOpen] = useState(false);
  const active = MODES.find((m) => m.id === mode)!;

  return (
    <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border-tertiary)] rounded-panel overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--color-bg-secondary)] transition-colors duration-fast"
      >
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-semibold tracking-[0.1em] uppercase text-[var(--color-text-tertiary)]">Mode</span>
          <span className="text-[11px] font-semibold text-[#6fcf3e]">{active.label}</span>
        </div>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={`text-[var(--color-text-tertiary)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="border-t border-[var(--color-border-tertiary)]">
          {MODES.map((m) => {
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setOpen(false); }}
                className={[
                  "w-full text-left px-3 py-2.5 transition-colors duration-fast",
                  isActive ? "bg-[#6fcf3e12]" : "hover:bg-[var(--color-bg-secondary)]",
                ].join(" ")}
              >
                <div className={`text-[11px] font-semibold ${isActive ? "text-[#6fcf3e]" : "text-[var(--color-text-primary)]"}`}>
                  {m.label}
                </div>
                <div className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{m.description}</div>
              </button>
            );
          })}
        </div>
      )}
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
  const store = useWorkspaceStore();
  const {
    project: storeProject,
    currentVersion,
    candidates,
    selectedCandidateId,
    activeCandidateId,
    activeVersionId,
    evaluationSummary,
    versionHistory,
    candidatesByVersionId,
    selectCandidate,
    evaluateAll,
    isGenerating,
    isEvaluating,
    isExecuting,
    isReverting,
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
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [hasRepo, setHasRepo] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem(`vyra_gh_repo_${project.id}`);
  });

  const handleRepoCreated = () => setHasRepo(true);

  // Phase 3: "Continue with this" collapse + prompt pulse
  const [candidatesCollapsed, setCandidatesCollapsed] = useState(false);
  const [shouldPulsePrompt, setShouldPulsePrompt] = useState(false);
  const promptWrapperRef = useRef<HTMLDivElement>(null);
  const viewportHandle = useRef<WorkspaceViewportHandle>(null);

  // Re-initialize model selection when the project changes
  useEffect(() => {
    const persisted = loadProjectModels(project.id);
    setSelectedModels(persisted ?? (project.models as ModelConfig[]));
  }, [project.id]);

  // Surface store errors as toasts
  useEffect(() => {
    if (error) setToastError(error);
  }, [error]);

  // Phase 3: Reset collapse when new candidates arrive
  useEffect(() => {
    setCandidatesCollapsed(false);
  }, [candidates]);

  // Phase 3: In agent mode, auto-collapse when the store auto-selects a candidate
  useEffect(() => {
    if (mode === "agent" && selectedCandidateId) {
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
  const unselectedCandidates = candidates.filter(
    (c) => c.id !== selectedCandidateId,
  );

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

  const handleContinueWithThis = () => {
  setCandidatesCollapsed(true);
  setShouldPulsePrompt(true);
  if (promptWrapperRef.current && viewportHandle.current) {
    viewportHandle.current.scrollCurrentToElement(promptWrapperRef.current);
    }
  setTimeout(() => setShouldPulsePrompt(false), 800);
  };

  const exportFiles = (winner ?? candidates[0])?.files ?? {};
  const hasFiles = Object.keys(exportFiles).length > 0;
  const githubModalMode = hasRepo ? "commit" : "create";
  const iterationCount = currentVersion?.depth ?? 0;

  return (
    <div className="min-h-screen bg-[var(--color-bg-tertiary)] p-4">
      <div className="max-w-[1080px] mx-auto flex flex-col gap-3">
        <TopBar
          projectName={currentVersion?.prompt ?? ""}
          hasFiles={hasFiles}
          hasRepo={hasRepo}
          onGitHubClick={() => setGithubModalOpen(true)}
        />

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
                  <SectionHeader>SELECTED OUTPUT</SectionHeader>
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
                    {hasRepo && (
                      <Button variant="ghost" size="sm" onClick={() => setGithubModalOpen(true)}>
                        Commit to GitHub
                      </Button>
                    )}
                  </div>
                </div>

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
                          forceCollapsed={candidatesCollapsed}
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
                  {others.map((c) => (
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
                  currentVersionLabel={winner ? `${winner.modelLabel} output` : undefined}
                  onBeforeSend={() => saveProjectModels(project.id, selectedModels)}
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

      {githubModalOpen && (
        <GitHubModal
          mode={githubModalMode}
          files={exportFiles}
          projectName={project.name}
          projectId={project.id}
          onRepoCreated={handleRepoCreated}
          onClose={() => setGithubModalOpen(false)}
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
