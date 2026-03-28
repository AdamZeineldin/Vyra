"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Candidate } from "@/lib/types";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModelChip } from "./model-chip";
import { FileExplorer } from "./file-explorer";
import { CodePreview } from "./code-preview";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

interface CandidateCardProps {
  candidate: Candidate;
  isWinner?: boolean;
  onSelect?: (id: string) => void;
  showOverride?: boolean;
  highlightIfRecommended?: boolean;
}

export function CandidateCard({
  candidate,
  isWinner,
  onSelect,
  showOverride,
  highlightIfRecommended,
}: CandidateCardProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(
    Object.keys(candidate.files)[0] ?? null
  );
  const [expanded, setExpanded] = useState(isWinner ?? false);
  const [overview, setOverview] = useState<string | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const lastFetchedId = useRef<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    if (lastFetchedId.current === candidate.id) return;
    lastFetchedId.current = candidate.id;
    setOverview(null);
    setIsLoadingOverview(true);
    fetch(`${BACKEND_URL}/overview/candidate/${candidate.id}`)
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => setOverview(data.overview as string))
      .catch(() => setOverview("Could not load AI overview."))
      .finally(() => setIsLoadingOverview(false));
  }, [expanded, candidate.id]);

  const fileCount = Object.keys(candidate.files).length;
  const previewContent = selectedFile
    ? candidate.files[selectedFile]?.content ?? ""
    : "";

  return (
    <Panel
      variant={isWinner ? "winner" : "default"}
      padding="md"
      className={[
        !isWinner && !highlightIfRecommended ? "opacity-70 hover:opacity-100" : "",
        highlightIfRecommended && !isWinner ? "border-primary-blue-border border-2" : "",
        "transition-opacity duration-fast",
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
          {showOverride && onSelect && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelect(candidate.id)}
            >
              Select this instead
            </Button>
          )}
          {!isWinner && !showOverride && onSelect && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelect(candidate.id)}
            >
              Select this
            </Button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors duration-fast"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
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
      {expanded && (
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
                  maxLines={12}
                />
              )}
            </div>
          </div>

          {/* AI Overview */}
          <div className="mt-3 pt-3 border-t border-[var(--color-border-secondary)]">
            <div className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide mb-1.5">
              AI Overview
            </div>
            {isLoadingOverview ? (
              <div className="text-[11px] text-[var(--color-text-tertiary)] animate-pulse">
                Generating overview…
              </div>
            ) : overview ? (
              <div className="prose-overview text-[11px] text-[var(--color-text-secondary)] leading-relaxed [&_h1]:text-[13px] [&_h1]:font-semibold [&_h1]:text-[var(--color-text-primary)] [&_h1]:mb-2 [&_h2]:text-[12px] [&_h2]:font-semibold [&_h2]:text-[var(--color-text-primary)] [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-[11px] [&_h3]:font-semibold [&_h3]:text-[var(--color-text-secondary)] [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_li]:mb-0.5">
                <ReactMarkdown>{overview}</ReactMarkdown>
              </div>
            ) : null}
          </div>
        </>
      )}

      {/* Collapsed snippet */}
      {!expanded && !candidate.error && selectedFile && (
        <CodePreview
          content={previewContent}
          filename={selectedFile}
          maxLines={3}
        />
      )}
    </Panel>
  );
}
