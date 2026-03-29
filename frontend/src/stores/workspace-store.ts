"use client";

import { create } from "zustand";
import type { Candidate, Project, Version, WorkspaceMode } from "@/lib/types";
import { shouldAutoSelect } from "@/lib/mode-logic";

import { BACKEND_URL } from "@/lib/config";

function str(a: unknown, b: unknown = undefined): string {
  return typeof a === "string" ? a : typeof b === "string" ? b : "";
}

function normalizeEvaluation(raw: unknown): Candidate["evaluation"] {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  return {
    scores: (e.scores ?? {}) as NonNullable<Candidate["evaluation"]>["scores"],
    totalScore: ((e.totalScore ?? e.total_score) as number) ?? 0,
    confidence: (e.confidence as number) ?? 0,
    reasoning: (e.reasoning as string) ?? "",
  } as NonNullable<Candidate["evaluation"]>;
}

function normalizeCandidate(raw: unknown): Candidate {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid candidate data received from API");
  }
  const c = raw as Record<string, unknown>;
  return {
    id: str(c.id, c.stream_id),
    versionId: str(c.versionId, c.version_id),
    modelId: str(c.modelId, c.model_id),
    modelLabel: str(c.modelLabel, c.model_label),
    files: (typeof c.files === "object" && c.files !== null) ? (c.files as Candidate["files"]) : {},
    rawResponse: str(c.rawResponse, c.raw_response),
    execution: (c.execution ?? null) as Candidate["execution"],
    evaluation: normalizeEvaluation(c.evaluation),
    selected: typeof c.selected === "boolean" ? c.selected : false,
    error: typeof c.error === "string" ? c.error : null,
    createdAt: str(c.createdAt, c.created_at) || new Date().toISOString(),
    streaming: false,
  };
}

async function* readSSELines(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const dataStr = line.slice(6).trim();
      if (!dataStr) continue;
      try { yield JSON.parse(dataStr) as Record<string, unknown>; } catch { /* skip malformed */ }
    }
  }
}

export interface EvaluationSummary {
  bestCandidateId: string | null;
  confidence: number;
  evaluations: Record<
    string,
    { total_score: number; scores: Record<string, number>; reasoning: string }
  >;
}

export interface CandidateRanking {
  candidateId: string;
  modelLabel: string;
  totalScore: number;
  scores: Record<string, number>;
  rank: number;
  reasoning: string;
}

export interface ComparisonOverview {
  comparison: string;
  rankings: CandidateRanking[];
}

interface WorkspaceStore {
  project: Project | null;
  currentVersion: Version | null;
  candidates: Candidate[];
  selectedCandidateId: string | null;
  evaluationSummary: EvaluationSummary | null;
  comparisonOverview: ComparisonOverview | null;
  isLoadingComparison: boolean;
  mode: WorkspaceMode;
  isGenerating: boolean;
  isEvaluating: boolean;
  isExecuting: boolean;
  isReverting: boolean;
  isLoadingOverview: boolean;
  prompt: string;
  error: string | null;
  versionHistory: Version[];
  activeVersionId: string | null;
  activeCandidateId: string | null;
  candidatesByVersionId: Record<string, Candidate[]>;

  setProject: (project: Project) => void;
  setMode: (mode: WorkspaceMode) => void;
  setPrompt: (prompt: string) => void;
  setLoadingOverview: (loading: boolean) => void;

  generate: (modelIds: string[]) => Promise<void>;
  executeAll: (runtime: string) => Promise<void>;
  evaluateAll: () => Promise<void>;
  fetchComparison: () => Promise<void>;
  selectCandidate: (candidateId: string, reason?: string) => Promise<void>;
  resetWorkspace: () => void;
  loadVersionTree: (projectId: string) => Promise<Version[]>;
  revertToVersion: (versionId: string) => Promise<boolean>;
  navigateToVersion: (versionId: string) => Promise<void>;
  navigateToCandidate: (versionId: string, candidateId: string) => Promise<void>;
  navigateToAdjacentVersion: (direction: "prev" | "next") => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  project: null,
  currentVersion: null,
  candidates: [],
  selectedCandidateId: null,
  evaluationSummary: null,
  comparisonOverview: null,
  isLoadingComparison: false,
  mode: "user",
  isGenerating: false,
  isEvaluating: false,
  isExecuting: false,
  isReverting: false,
  isLoadingOverview: false,
  prompt: "",
  error: null,
  versionHistory: [],
  activeVersionId: null,
  activeCandidateId: null,
  candidatesByVersionId: {},

  setProject: (project) => set({ project }),
  setMode: (mode) => set({ mode }),
  setPrompt: (prompt) => set({ prompt }),
  setLoadingOverview: (loading) => set({ isLoadingOverview: loading }),

  resetWorkspace: () =>
    set({
      currentVersion: null,
      candidates: [],
      selectedCandidateId: null,
      evaluationSummary: null,
      comparisonOverview: null,
      isLoadingComparison: false,
      isGenerating: false,
      isEvaluating: false,
      isExecuting: false,
      isReverting: false,
      isLoadingOverview: false,
      prompt: "",
      error: null,
      versionHistory: [],
      activeVersionId: null,
      activeCandidateId: null,
      candidatesByVersionId: {},
    }),

  generate: async (modelIds) => {
    const { project, currentVersion, prompt, mode } = get();
    if (!project || !prompt.trim()) return;

    const submittedPrompt = prompt;
    set({ isGenerating: true, error: null, candidates: [], evaluationSummary: null, selectedCandidateId: null, prompt: "" });

    try {
      const res = await fetch(`${BACKEND_URL}/generate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: submittedPrompt,
          parent_version_id: currentVersion?.id ?? null,
          model_ids: modelIds,
          project_id: project.id,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((err as { detail?: string }).detail ?? "Generation failed");
      }

    // ...existing code...
    const reader = res.body.getReader();
    let versionId: string | null = null;

    for await (const event of readSSELines(reader)) {
      if (event.type === "version_created") {
        versionId = event.version_id as string;

        const newVersion = {
          id: versionId,
          prompt: submittedPrompt,
          parentId: currentVersion?.id ?? null,
          projectId: project.id,
        } as Version;

        set((state) => ({
          currentVersion: newVersion,
          activeVersionId: versionId,
          versionHistory: [...state.versionHistory, newVersion],
        }));
      } else if (event.type === "candidate_started") {
        const placeholder: Candidate = {
          id: event.stream_id as string,
          versionId: versionId ?? "",
          modelId: event.model_id as string,
          modelLabel: event.model_label as string,
          files: {},
          rawResponse: "",
          execution: null,
          evaluation: null,
          selected: false,
          error: null,
          createdAt: new Date().toISOString(),
          streaming: true,
        };
        set((state) => ({ candidates: [...state.candidates, placeholder] }));
      } else if (event.type === "candidate_chunk") {
        set((state) => ({
          candidates: state.candidates.map((c) =>
            c.id === (event.stream_id as string)
              ? { ...c, rawResponse: c.rawResponse + (event.chunk as string) }
              : c
          ),
        }));
      } else if (event.type === "candidate_done") {
        const finalized = normalizeCandidate(event);
        set((state) => ({
          candidates: state.candidates.map((c) =>
            c.id === (event.stream_id as string)
              ? { ...finalized, streaming: false }
              : c
          ),
        }));
      } else if (event.type === "project_name") {
        const name = event.name as string;
        set((state) => ({
          project: state.project ? { ...state.project, name } : null,
        }));
      } else if (event.type === "done") {
        const doneVersionId =
          (typeof event.version_id === "string" ? event.version_id : versionId) ?? null;
        if (doneVersionId) {
          set((state) => ({
            candidatesByVersionId: {
              ...state.candidatesByVersionId,
              [doneVersionId]: state.candidates,
            },
          }));
        }
        break;
      }
    }

      // In agent/hybrid mode: auto-execute, evaluate, compare, and select
      if (mode === "agent" || mode === "hybrid") {
        await get().executeAll(project.runtime ?? "node");
        await get().evaluateAll();
        get().fetchComparison().catch(() => {});
        const { evaluationSummary } = get();
        if (
          evaluationSummary?.bestCandidateId &&
          shouldAutoSelect(mode, evaluationSummary.confidence)
        ) {
          await get().selectCandidate(evaluationSummary.bestCandidateId);
        }
      }
      // In user mode: just generate — user triggers evaluation manually
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Generation failed" });
    } finally {
      set({ isGenerating: false });
    }
  },

  executeAll: async (runtime) => {
    const { candidates } = get();
    set({ isExecuting: true, error: null });
    try {
      const results = await Promise.allSettled(
        candidates.map((c) =>
          fetch(`${BACKEND_URL}/execute/candidate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ candidate_id: c.id, runtime }),
          })
        )
      );
      const failures = results.filter((r) => r.status === "rejected").length;
      if (failures > 0) {
        set({ error: `${failures} of ${candidates.length} candidate(s) failed to execute` });
      }
    } finally {
      set({ isExecuting: false });
    }
  },

  evaluateAll: async () => {
    const { currentVersion } = get();
    if (!currentVersion) return;

    // Use the version's own prompt — the store's prompt field is cleared after
    // submission, so reading it here would send an empty string to the evaluator.
    const versionPrompt = currentVersion.prompt ?? "";

    set({ isEvaluating: true });
    try {
      const res = await fetch(`${BACKEND_URL}/execute/evaluate-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version_id: currentVersion.id,
          prompt: versionPrompt,
        }),
      });

      if (!res.ok) {
        set({ error: "Evaluation failed" });
        return;
      }
      const data = await res.json();

      set({
        evaluationSummary: {
          bestCandidateId: data.best_candidate_id,
          confidence: data.confidence,
          evaluations: data.evaluations,
        },
        // Update candidates with evaluation data
        candidates: get().candidates.map((c) => ({
          ...c,
          evaluation: data.evaluations[c.id]
            ? {
                scores: data.evaluations[c.id].scores,
                totalScore: data.evaluations[c.id].total_score,
                confidence: data.confidence,
                reasoning: data.evaluations[c.id].reasoning,
              }
            : c.evaluation,
        })),
      });
    } finally {
      set({ isEvaluating: false });
    }
  },

  fetchComparison: async () => {
    const { currentVersion } = get();
    if (!currentVersion) return;

    set({ isLoadingComparison: true });
    try {
      const res = await fetch(`${BACKEND_URL}/overview/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_id: currentVersion.id }),
      });

      if (!res.ok) return;
      const data = await res.json();

      set({
        comparisonOverview: {
          comparison: data.comparison,
          rankings: (data.rankings ?? []).map((r: Record<string, unknown>) => ({
            candidateId: r.candidate_id as string,
            modelLabel: r.model_label as string,
            totalScore: r.total_score as number,
            scores: r.scores as Record<string, number>,
            rank: r.rank as number,
            reasoning: r.reasoning as string,
          })),
        },
      });
    } finally {
      set({ isLoadingComparison: false });
    }
  },

  selectCandidate: async (candidateId, reason) => {
    const { project, currentVersion } = get();
    if (!project || !currentVersion) return;

    try {
      const res = await fetch(`${BACKEND_URL}/versions/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidateId,
          version_id: currentVersion.id,
          project_id: project.id,
          override_reason: reason ?? null,
        }),
      });

      if (!res.ok) throw new Error("Selection failed");

      set((state) => ({
        selectedCandidateId: candidateId,
        activeCandidateId: candidateId,
        candidates: state.candidates.map((c) => ({
          ...c,
          selected: c.id === candidateId,
        })),
      }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Selection failed" });
    }
  },

  loadVersionTree: async (projectId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/versions/${encodeURIComponent(projectId)}/tree`);
      if (!res.ok) return [];
      const versions: Version[] = await res.json();

      const sorted = [...versions].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      set({ versionHistory: sorted });
      return sorted;
    } catch {
      set({ error: "Failed to load version tree" });
      return [];
    }
  },

  revertToVersion: async (versionId) => {
    const { project } = get();
    if (!project) return false;

    set({ isReverting: true, error: null });

    try {
      const res = await fetch(
        `${BACKEND_URL}/versions/${encodeURIComponent(versionId)}/candidates`
      );

      if (!res.ok) {
        throw new Error(`Failed to load candidates for version ${versionId}`);
      }

      const payload = (await res.json()) as unknown;
      if (!Array.isArray(payload)) {
        throw new Error("Invalid candidates payload");
      }
      const candidates: Candidate[] = payload.map(normalizeCandidate);

      // Find the selected candidate (winner) for this version
      const winner = candidates.find((c) => c.selected) ?? null;

      // Rebuild evaluationSummary from persisted candidate evaluation data
      // so scores survive tab reloads without re-running evaluation
      const evaluatedCandidates = candidates.filter((c) => c.evaluation);
      let restoredSummary: EvaluationSummary | null = null;
      if (evaluatedCandidates.length > 0) {
        const evaluations: EvaluationSummary["evaluations"] = {};
        let bestId: string | null = null;
        let bestScore = -1;
        for (const c of evaluatedCandidates) {
          const ev = c.evaluation!;
          evaluations[c.id] = {
            total_score: ev.totalScore,
            scores: ev.scores as unknown as Record<string, number>,
            reasoning: ev.reasoning,
          };
          if (ev.totalScore > bestScore) {
            bestScore = ev.totalScore;
            bestId = c.id;
          }
        }
        const allScores = evaluatedCandidates.map((c) => c.evaluation!.totalScore);
        const sortedScores = [...allScores].sort((a, b) => b - a);
        const gap = sortedScores.length > 1 ? sortedScores[0] - sortedScores[1] : 3;
        const confidence = Math.min(gap / 3, 1);
        restoredSummary = { bestCandidateId: bestId, confidence, evaluations };
      }

      const { versionHistory } = get();

      const revertedVersion =
        versionHistory.find((v) => v.id === versionId) ??
        ({ id: versionId, projectId: project?.id ?? "", parentId: null, prompt: "", selectedCandidateId: null, files: {}, mode: "user", depth: 0, createdAt: new Date().toISOString() } as Version);

      // Navigate to the target version without deleting future versions
      set((state) => ({
        activeVersionId: versionId,
        currentVersion: revertedVersion,
        candidates,
        selectedCandidateId: winner?.id ?? null,
        evaluationSummary: restoredSummary,
        comparisonOverview: null,
        activeCandidateId: null,
        candidatesByVersionId: {
          ...state.candidatesByVersionId,
          [versionId]: candidates,
        },
      }));
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Revert failed" });
      return false;
    } finally {
      set({ isReverting: false });
    }
  },

  navigateToVersion: async (versionId) => {
    await get().revertToVersion(versionId);
    // activeCandidateId already reset to null inside revertToVersion
  },

  navigateToCandidate: async (versionId, candidateId) => {
    const success = await get().revertToVersion(versionId);
    if (success) {
      set({ activeCandidateId: candidateId });
    }
  },

  navigateToAdjacentVersion: async (direction) => {
    const { versionHistory, activeVersionId, navigateToVersion } = get();
    if (!versionHistory || versionHistory.length === 0) return;

    const currentIndex = activeVersionId
      ? versionHistory.findIndex((v) => v.id === activeVersionId)
      : -1;

    let newIndex: number;
    if (direction === "next") {
      newIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, versionHistory.length - 1);
    } else {
      newIndex = currentIndex === -1
        ? versionHistory.length - 1
        : Math.max(currentIndex - 1, 0);
    }

    if (newIndex !== currentIndex && versionHistory[newIndex]) {
      await navigateToVersion(versionHistory[newIndex].id);
    }
  },
}));
