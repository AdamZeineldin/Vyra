"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronUp, Play, Loader2, GitCommitHorizontal } from "lucide-react";
import type { Candidate } from "@/lib/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getModelAccentBorder } from "@/lib/model-colors";
import { ModelChip } from "./model-chip";
import { FileExplorer } from "./file-explorer";
import { CodePreview } from "./code-preview";

import { ConsoleModal } from "./console-modal";
import { StdinModal } from "./stdin-modal";
        
import { GitHubModal } from "@/components/github/github-modal";

const STDIN_PATTERNS = ["input(", "Scanner(", "readline(", "gets ", "cin >>", "sys.stdin", "STDIN"];

function needsStdin(candidate: Candidate): boolean {
  return Object.values(candidate.files).some((f) =>
    STDIN_PATTERNS.some((p) => f.content.includes(p))
  );
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

interface CandidateCardProps {
  candidate: Candidate;
  isWinner?: boolean;
  isActive?: boolean;
  onSelect?: (id: string) => void;
  showOverride?: boolean;
  highlightIfRecommended?: boolean;
  /** When true, this card is collapsed regardless of its internal expand state.
   *  The user can override this per-card by clicking "View full output". */
  forceCollapsed?: boolean;
}

export function CandidateCard({
  candidate,
  isWinner,
  isActive,
  onSelect,
  showOverride,
  highlightIfRecommended,
  forceCollapsed = false,
}: CandidateCardProps) {
  const { project, candidates: allCandidates } = useWorkspaceStore();
  const cardRef = useRef<HTMLDivElement>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(
    Object.keys(candidate.files)[0] ?? null
  );
  const [expanded, setExpanded] = useState(isWinner ?? false);
  // When forceCollapsed=true, this local override lets the user expand just this card
  const [userExpandedOverride, setUserExpandedOverride] = useState(false);
  const [overview, setOverview] = useState<string | null>(null);
  const [overviewStatus, setOverviewStatus] = useState<"not_started" | "generating" | "ready">("not_started");
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [consoleResult, setConsoleResult] = useState<any | null>(null);
  const [showStdinModal, setShowStdinModal] = useState(false);
  const runtime = useWorkspaceStore((s) => s.project?.runtime ?? "python");

  // Poll for comparison overview — only for the selected (winner) card
  useEffect(() => {
    if (!isWinner || !expanded) return;

    const fetchOverview = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/overview/candidate/${candidate.id}`);
        if (!res.ok) return;
        const data = await res.json() as { overview: string | null; status: string };
        setOverviewStatus(data.status as "not_started" | "generating" | "ready");
        if (data.overview) {
          setOverview(data.overview);
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {
        // ignore fetch errors during polling
      }
    };

    fetchOverview();
    // Poll every 3s while generating
    pollRef.current = setInterval(fetchOverview, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWinner, expanded, candidate.id]);

  // Scroll into view when this card becomes active via tree navigation
  useEffect(() => {
    if (isActive && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isActive]);

  const fileCount = Object.keys(candidate.files).length;
  const selectedFileEntry = selectedFile ? candidate.files[selectedFile] : null;
  const previewContent = selectedFileEntry?.content ?? "";
  const previewLanguage = selectedFileEntry?.language;

  const accentBorder = getModelAccentBorder(candidate.modelId ?? "");

  // The card shows its expanded content only when locally expanded AND either
  // forceCollapsed is false or the user has explicitly clicked "View full output".
  const isVisiblyExpanded = expanded && (!forceCollapsed || userExpandedOverride);
  const handleRun = () => {
    if (isRunning) return;
    if (needsStdin(candidate)) {
      setShowStdinModal(true);
    } else {
      runWithStdin("");
    }
  };

  const runWithStdin = async (stdin: string) => {
    setShowStdinModal(false);
    setIsRunning(true);
    try {
      const res = await fetch(`${BACKEND_URL}/execute/candidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: candidate.id, runtime, stdin }),
      });
      const data = await res.json();
      setConsoleResult(data.execution);
    } catch {
      setConsoleResult({ stdout: "", stderr: "Failed to reach execution server.", exit_code: 1, duration_ms: 0, timed_out: false });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
    <div ref={cardRef}>
    <Panel
      variant={isWinner ? "winner" : "default"}
      padding="md"
      className={[
        !isWinner ? accentBorder : "",
        !isWinner && !highlightIfRecommended && !isActive ? "opacity-70 hover:opacity-100" : "",
        highlightIfRecommended && !isWinner ? "border-primary-blue-border border-2" : "",
        isActive && !isWinner ? "ring-1 ring-[var(--color-primary-blue)] ring-offset-1 ring-offset-[var(--color-bg-tertiary)]" : "",
        "transition-all duration-200",
      ].join(" ")}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ModelChip modelId={candidate.modelId} modelLabel={candidate.modelLabel} />
          {isWinner && (
            <Badge variant="winner" dot>
              Selected
            </Badge>
          )}
          {candidate.evaluation && (
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              {Math.round(candidate.evaluation.totalScore * 10) / 10}/10
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setGithubModalOpen(true)}
            title="Commit to GitHub"
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors duration-fast"
          >
            <GitCommitHorizontal size={13} />
          </button>
          {showOverride && onSelect && (
            <Button variant="ghost" size="sm" onClick={() => onSelect(candidate.id)}>
              Select this instead
            </Button>
          )}
          {!isWinner && !showOverride && onSelect && (
            <Button variant="ghost" size="sm" onClick={() => onSelect(candidate.id)}>
              Select this
            </Button>
          )}
          {forceCollapsed && !userExpandedOverride && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setUserExpandedOverride(true);
                setExpanded(true);
              }}
            >
              View full output
            </Button>
          )}
          
          <button
            onClick={handleRun}
            disabled={isRunning}
            title="Run program"
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-green-900/40 border border-green-800/60 text-green-400 hover:bg-green-900/70 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-fast"
          >
            {isRunning ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
            {isRunning ? "Running…" : "Run"}
          </button>
          
          <button
            data-testid="expand-toggle"
            onClick={() => setExpanded(!expanded)}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors duration-fast"
          >
            {isVisiblyExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Error state */}
      {candidate.error && (
        <div className="text-[11px] text-warning-text bg-warning-bg rounded-btn px-2 py-1.5 mb-2">
          Error: {candidate.error}
        </div>
      )}

      {/* File count */}
      <div className="text-[10px] text-[var(--color-text-tertiary)] mb-2">
        {fileCount} file{fileCount !== 1 ? "s" : ""}
      </div>

      {/* Expanded content */}
      {isVisiblyExpanded && (
        <>
          <div className="flex gap-3 mt-2">
            {/* File tree */}
            <div className="w-40 flex-shrink-0">
              <FileExplorer
                files={candidate.files}
                selectedPath={selectedFile ?? undefined}
                onSelectFile={setSelectedFile}
              />
            </div>

            {/* Code preview */}
            <div className="flex-1 min-w-0">
              {selectedFile && (
                <CodePreview
                  content={previewContent}
                  filename={selectedFile}
                  language={previewLanguage}
                  maxLines={12}
                />
              )}
            </div>
          </div>

          {/* Comparison Overview — winner only, and only when multiple models ran */}
          {isWinner && allCandidates.length > 1 && (
            <div className="mt-3 pt-3 border-t border-[var(--color-border-secondary)]">
              <div className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide mb-1.5">
                Why this model?
              </div>
              {overviewStatus === "generating" || (overviewStatus === "not_started" && !overview) ? (
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                  <Loader2 size={10} className="animate-spin flex-shrink-0" />
                  Analyzing differences…
                </div>
              ) : overview ? (
                <div className="prose-overview text-[11px] text-[var(--color-text-secondary)] leading-relaxed [&_h2]:text-[11px] [&_h2]:font-semibold [&_h2]:text-[var(--color-text-primary)] [&_h2]:mt-2.5 [&_h2]:mb-1 [&_p]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-1.5 [&_li]:mb-0.5">
                  <ReactMarkdown>{overview}</ReactMarkdown>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}

      {/* Collapsed snippet */}
      {!isVisiblyExpanded && !candidate.error && selectedFile && (
        <CodePreview
          content={previewContent}
          filename={selectedFile}
          language={previewLanguage}
          maxLines={3}
        />
      )}
    </Panel>

      {showStdinModal && (
        <StdinModal
          modelLabel={candidate.modelLabel}
          candidate={candidate}
          onRun={runWithStdin}
          onCancel={() => setShowStdinModal(false)}
        />
      )}

      {consoleResult && (
        <ConsoleModal
          modelLabel={candidate.modelLabel}
          result={consoleResult}
          onClose={() => setConsoleResult(null)}
        />
      )}
    </div>

    {githubModalOpen && project && (
      <GitHubModal
        mode="commit"
        files={candidate.files}
        projectName={project.name}
        projectId={project.id}
        onClose={() => setGithubModalOpen(false)}
      />
    )}
    </>
  );
}
