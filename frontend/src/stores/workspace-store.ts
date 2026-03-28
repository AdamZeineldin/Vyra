"use client";

import { create } from "zustand";
import type { Candidate, Project, Version, WorkspaceMode } from "@/lib/types";
import { shouldAutoSelect } from "@/lib/mode-logic";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export interface EvaluationSummary {
  bestCandidateId: string | null;
  confidence: number;
  evaluations: Record<
    string,
    { total_score: number; scores: Record<string, number>; reasoning: string }
  >;
}

interface WorkspaceStore {
  project: Project | null;
  currentVersion: Version | null;
  candidates: Candidate[];
  selectedCandidateId: string | null;
  evaluationSummary: EvaluationSummary | null;
  mode: WorkspaceMode;
  isGenerating: boolean;
  isEvaluating: boolean;
  isExecuting: boolean;
  isReverting: boolean;
  iterationCount: number;
  prompt: string;
  error: string | null;
  versionHistory: Version[];
  activeVersionId: string | null;

  setProject: (project: Project) => void;
  setMode: (mode: WorkspaceMode) => void;
  setPrompt: (prompt: string) => void;

  generate: (modelIds: string[]) => Promise<void>;
  executeAll: (runtime: string) => Promise<void>;
  evaluateAll: () => Promise<void>;
  selectCandidate: (candidateId: string, reason?: string) => Promise<void>;
  loadVersionTree: (projectId: string) => Promise<Version[]>;
  revertToVersion: (versionId: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  project: null,
  currentVersion: null,
  candidates: [],
  selectedCandidateId: null,
  evaluationSummary: null,
  mode: "user",
  isGenerating: false,
  isEvaluating: false,
  isExecuting: false,
  isReverting: false,
  iterationCount: 0,
  prompt: "",
  error: null,
  versionHistory: [],
  activeVersionId: null,

  setProject: (project) => set({ project }),
  setMode: (mode) => set({ mode }),
  setPrompt: (prompt) => set({ prompt }),

  generate: async (modelIds) => {
    const { project, currentVersion, prompt, mode } = get();
    if (!project || !prompt.trim()) return;

    set({ isGenerating: true, error: null, candidates: [], evaluationSummary: null, selectedCandidateId: null });

    try {
      const res = await fetch(`${BACKEND_URL}/generate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          parent_version_id: currentVersion?.id ?? null,
          model_ids: modelIds,
          project_id: project.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail ?? "Generation failed");
      }

      const data = await res.json();
      const newVersion = { id: data.version_id } as Version;

      // Normalize snake_case API response to camelCase frontend types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const candidates = (data.candidates ?? []).map((c: any) => ({
        ...c,
        modelId: c.modelId ?? c.model_id,
        modelLabel: c.modelLabel ?? c.model_label,
      }));

      set((state) => ({
        candidates,
        currentVersion: newVersion,
        activeVersionId: data.version_id,
        versionHistory: [...state.versionHistory, newVersion],
        prompt: "",
        iterationCount: state.iterationCount + 1,
      }));

      // In agent/hybrid mode: auto-execute + evaluate, then conditionally auto-select
      if (mode === "agent" || mode === "hybrid") {
        await get().executeAll(project.runtime);
        await get().evaluateAll();
        const { evaluationSummary } = get();
        if (
          evaluationSummary?.bestCandidateId &&
          shouldAutoSelect(mode, evaluationSummary.confidence)
        ) {
          await get().selectCandidate(evaluationSummary.bestCandidateId);
        }
      }
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Generation failed" });
    } finally {
      set({ isGenerating: false });
    }
  },

  executeAll: async (runtime) => {
    const { candidates } = get();
    set({ isExecuting: true });
    try {
      await Promise.allSettled(
        candidates.map((c) =>
          fetch(`${BACKEND_URL}/execute/candidate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ candidate_id: c.id, runtime }),
          })
        )
      );
    } finally {
      set({ isExecuting: false });
    }
  },

  evaluateAll: async () => {
    const { currentVersion, prompt } = get();
    if (!currentVersion) return;

    set({ isEvaluating: true });
    try {
      const res = await fetch(`${BACKEND_URL}/execute/evaluate-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version_id: currentVersion.id,
          prompt,
        }),
      });

      if (!res.ok) return;
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
    const res = await fetch(`${BACKEND_URL}/versions/${projectId}/tree`);
    if (!res.ok) return [];
    const versions: Version[] = await res.json();

    // Keep versionHistory in sync with the full tree (ordered oldest → newest)
    const sorted = [...versions].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    set({ versionHistory: sorted });
    return versions;
  },

  revertToVersion: async (versionId) => {
    const { project } = get();
    if (!project) return;

    set({ isReverting: true, error: null });

    try {
      const res = await fetch(
        `${BACKEND_URL}/versions/${versionId}/candidates`
      );

      if (!res.ok) {
        throw new Error(`Failed to load candidates for version ${versionId}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const candidates: Candidate[] = (await res.json()).map((c: any) => ({
        ...c,
        modelId: c.modelId ?? c.model_id,
        modelLabel: c.modelLabel ?? c.model_label,
      }));

      // Find the selected candidate (winner) for this version
      const winner = candidates.find((c) => c.selected) ?? null;

      // Determine iteration count: use the version's depth + 1 if available
      // We derive it from versionHistory position so we don't need the full Version object
      const { versionHistory } = get();
      const historyIndex = versionHistory.findIndex((v) => v.id === versionId);
      const iterationCount = historyIndex >= 0 ? historyIndex + 1 : get().iterationCount;

      const revertedVersion =
        versionHistory.find((v) => v.id === versionId) ??
        ({ id: versionId } as Version);

      // Navigate to the target version without deleting future versions
      set({
        activeVersionId: versionId,
        currentVersion: revertedVersion,
        candidates,
        selectedCandidateId: winner?.id ?? null,
        iterationCount,
        evaluationSummary: null,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Revert failed" });
    } finally {
      set({ isReverting: false });
    }
  },
}));
