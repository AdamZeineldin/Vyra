"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, GitCommitHorizontal } from "lucide-react";
import type { Candidate } from "@/lib/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getModelAccentBorder } from "@/lib/model-colors";
import { ModelChip } from "./model-chip";
import { FileExplorer } from "./file-explorer";
import { CodePreview } from "./code-preview";
import { GitHubModal } from "@/components/github/github-modal";

const SCORE_LABELS: Record<string, string> = {
  correctness: "Correct",
  completeness: "Complete",
  efficiency: "Efficient",
  code_quality: "Quality",
  codeQuality: "Quality",
};

interface CandidateCardProps {
  candidate: Candidate;
  isWinner?: boolean;
  isActive?: boolean;
  onSelect?: (id: string) => void;
  showOverride?: boolean;
  highlightIfRecommended?: boolean;
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
  const { project } = useWorkspaceStore();
  const cardRef = useRef<HTMLDivElement>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(
    Object.keys(candidate.files)[0] ?? null
  );
  const [expanded, setExpanded] = useState(isWinner ?? false);
  const [userExpandedOverride, setUserExpandedOverride] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [githubModalOpen, setGithubModalOpen] = useState(false);

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
  const isVisiblyExpanded = expanded && (!forceCollapsed || userExpandedOverride);
  const ev = candidate.evaluation;

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
        isWinner ? "animate-glow" : "",
        "transition-all duration-smooth ease-smooth",
      ].join(" ")}
    >
      {/* Header — model chip, score, actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ModelChip modelId={candidate.modelId} modelLabel={candidate.modelLabel} />
          {isWinner && <Badge variant="winner" dot>Selected</Badge>}
          {ev && (
            <button
              onClick={() => setShowScores((s) => !s)}
              className={`text-[11px] font-semibold cursor-pointer hover:opacity-80 transition-opacity ${isWinner ? "text-winner-text" : "text-[var(--color-text-secondary)]"}`}
              title="Toggle score breakdown"
            >
              {Math.round((ev.totalScore ?? 0) * 10) / 10}/10
              <ChevronDown size={9} className={`inline ml-0.5 transition-transform duration-fast ${showScores ? "rotate-180" : ""}`} />
            </button>
          )}
          <span className="text-[10px] text-[var(--color-text-tertiary)]">
            {fileCount} file{fileCount !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {showOverride && onSelect && (
            <Button variant="ghost" size="sm" onClick={() => onSelect(candidate.id)}>Select this instead</Button>
          )}
          {!isWinner && !showOverride && onSelect && (
            <Button variant="ghost" size="sm" onClick={() => onSelect(candidate.id)}>Select this</Button>
          )}
          {forceCollapsed && !userExpandedOverride && (
            <Button variant="ghost" size="sm" onClick={() => { setUserExpandedOverride(true); setExpanded(true); }}>View full output</Button>
          )}
          <button onClick={() => setGithubModalOpen(true)} title="Commit to GitHub" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors duration-fast">
            <GitCommitHorizontal size={13} />
          </button>
          <button data-testid="expand-toggle" onClick={() => setExpanded(!expanded)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors duration-fast">
            {isVisiblyExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Score dropdown — toggled by clicking score */}
      {ev && showScores && (() => {
        const entries = Object.entries(ev.scores) as [string, number][];
        return (
          <div className="mt-2 vyra-fade-in">
            <div className="flex gap-3 text-[9px] text-[var(--color-text-tertiary)]">
              {entries.map(([key, val]) => {
                const v = val ?? 0;
                return (
                  <span key={key}>
                    <span className={`font-semibold ${v >= 7.5 ? "text-winner-text" : v < 5 ? "text-warning-text" : "text-[var(--color-text-secondary)]"}`}>
                      {v.toFixed(1)}
                    </span>
                    {" "}{SCORE_LABELS[key] ?? key}
                  </span>
                );
              })}
            </div>
            {ev.reasoning && (
              <p className="text-[10px] text-[var(--color-text-secondary)] mt-1.5 leading-snug">
                {ev.reasoning}
              </p>
            )}
          </div>
        );
      })()}

      {/* Error state */}
      {candidate.error && (
        <div className="text-[11px] text-warning-text bg-warning-bg rounded-btn px-2 py-1.5 mt-2">
          Error: {candidate.error}
        </div>
      )}

      {/* Expanded content */}
      {isVisiblyExpanded && (
        <div className="flex gap-3 mt-3">
          <div className="w-40 flex-shrink-0">
            <FileExplorer
              files={candidate.files}
              selectedPath={selectedFile ?? undefined}
              onSelectFile={setSelectedFile}
            />
          </div>
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
      )}

      {/* Collapsed snippet */}
      {!isVisiblyExpanded && !candidate.error && selectedFile && (
        <div className="mt-2">
          <CodePreview
            content={previewContent}
            filename={selectedFile}
            language={previewLanguage}
            maxLines={3}
          />
        </div>
      )}
    </Panel>
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
