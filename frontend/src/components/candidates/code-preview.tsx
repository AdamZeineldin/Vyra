"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";

interface CodePreviewProps {
  content: string;
  filename?: string;
  maxLines?: number;
  className?: string;
}

function FilePopout({
  content,
  filename,
  onClose,
}: {
  content: string;
  filename?: string;
  onClose: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div
        className="relative z-10 w-[70vw] max-w-4xl h-[75vh] flex flex-col bg-[var(--color-bg-secondary)] rounded-btn shadow-2xl border border-[var(--color-border-default)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border-default)] flex-shrink-0">
          <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">
            {filename ?? "file"}
          </span>
          <button
            onClick={onClose}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors duration-fast"
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-4">
          <pre className="font-mono text-[11px] leading-relaxed text-[var(--color-text-secondary)] whitespace-pre min-w-max">
            {content}
          </pre>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function CodePreview({
  content,
  filename,
  maxLines = 8,
  className = "",
}: CodePreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [popout, setPopout] = useState(false);

  const allLines = content.split("\n");
  const isTruncatable = allLines.length > maxLines;
  const displayLines = expanded ? allLines : allLines.slice(0, maxLines);

  return (
    <>
      <div
        className={[
          "bg-[var(--color-bg-secondary)] rounded-btn font-mono text-[11px] leading-relaxed overflow-hidden relative group",
          className,
        ].join(" ")}
      >
        {/* Popout icon — top right, visible on hover */}
        <button
          onClick={() => setPopout(true)}
          aria-label="Open code in popout"
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:ring-1 focus-visible:ring-[var(--color-border-info)] transition-opacity duration-fast text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] rounded p-0.5"
        >
          <Maximize2 size={11} />
        </button>

        {/* Code area */}
        <div
          className={[
            "p-3 overflow-x-auto",
            expanded ? "overflow-y-auto max-h-72" : "overflow-y-hidden",
          ].join(" ")}
        >
          <pre className="text-[var(--color-text-secondary)] whitespace-pre min-w-max">
            {displayLines.join("\n")}
          </pre>
        </div>

        {/* View all / collapse toggle */}
        {isTruncatable && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-center text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] py-1.5 border-t border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] transition-colors duration-fast"
          >
            {expanded
              ? "Collapse"
              : `View all — ${allLines.length - maxLines} more lines`}
          </button>
        )}
      </div>

      {popout && (
        <FilePopout
          content={content}
          filename={filename}
          onClose={() => setPopout(false)}
        />
      )}
    </>
  );
}