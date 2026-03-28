// === File System ===

export interface FileEntry {
  readonly path: string;
  readonly content: string;
  readonly language: string;
}

export type FileMap = Readonly<Record<string, FileEntry>>;

// === Models ===

export interface ModelConfig {
  readonly id: string;
  readonly label: string;
  readonly provider: string;
}

// === Project ===

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly models: readonly ModelConfig[];
  readonly rootVersionId: string | null;
  readonly currentVersionId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// === Version (Node in the tree) ===

export interface Version {
  readonly id: string;
  readonly projectId: string;
  readonly parentId: string | null;
  readonly prompt: string;
  readonly selectedCandidateId: string | null;
  readonly files: FileMap;
  readonly mode: "user" | "agent" | "hybrid";
  readonly depth: number;
  readonly createdAt: string;
}

// === Candidate (one per model per iteration) ===

export interface ExecutionResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly timedOut: boolean;
}

export interface RubricScores {
  readonly correctness: number;
  readonly codeQuality: number;
  readonly completeness: number;
  readonly efficiency: number;
}

export interface Evaluation {
  readonly scores: RubricScores;
  readonly totalScore: number;
  readonly confidence: number;
  readonly reasoning: string;
}

export interface Candidate {
  readonly id: string;
  readonly versionId: string;
  readonly modelId: string;
  readonly modelLabel: string;
  readonly files: FileMap;
  readonly rawResponse: string;
  readonly execution: ExecutionResult | null;
  readonly evaluation: Evaluation | null;
  readonly selected: boolean;
  readonly error: string | null;
  readonly createdAt: string;
}

// === API request/response shapes (frontend → Python backend) ===

export interface GenerateRequest {
  readonly prompt: string;
  readonly parentVersionId: string | null;
  readonly modelIds: readonly string[];
  readonly projectId: string;
}

export interface CandidateResponse {
  readonly modelId: string;
  readonly modelLabel: string;
  readonly files: FileMap;
  readonly rawResponse: string;
  readonly error: string | null;
}

// === Workspace UI state ===

export type WorkspaceMode = "user" | "agent" | "hybrid";

export interface WorkspaceState {
  readonly project: Project | null;
  readonly currentVersion: Version | null;
  readonly candidates: readonly Candidate[];
  readonly selectedCandidateId: string | null;
  readonly mode: WorkspaceMode;
  readonly isGenerating: boolean;
  readonly isExecuting: boolean;
}

// === Diff ===

export interface FileDiff {
  readonly path: string;
  readonly status: "added" | "modified" | "deleted";
  readonly hunks: string;
}

export interface DiffSummary {
  readonly filesAdded: number;
  readonly filesModified: number;
  readonly filesDeleted: number;
  readonly totalChanges: number;
}
