"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/prism";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodePreviewProps {
  content: string;
  filename?: string;
  language?: string;
  maxLines?: number;
  className?: string;
}

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  json: "json",
  md: "markdown",
  css: "css",
  scss: "scss",
  html: "html",
  sh: "bash",
  bash: "bash",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  go: "go",
  rs: "rust",
  rb: "ruby",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  cpp: "cpp",
  c: "c",
  cs: "csharp",
  php: "php",
  sql: "sql",
  graphql: "graphql",
  xml: "xml",
  env: "bash",
  dockerfile: "dockerfile",
};

function detectLanguage(filename?: string, languageHint?: string): string {
  if (languageHint && languageHint !== "plaintext" && languageHint !== "text") {
    return languageHint;
  }
  if (!filename) return "text";
  const base = filename.split("/").pop() ?? filename;
  if (base.toLowerCase() === "dockerfile") return "dockerfile";
  const ext = base.split(".").pop()?.toLowerCase();
  return EXT_TO_LANG[ext ?? ""] ?? "text";
}

// Shared highlighter styles — transparent bg so the container controls it
const HIGHLIGHTER_STYLE = {
  ...vscDarkPlus,
  'pre[class*="language-"]': {
    ...vscDarkPlus['pre[class*="language-"]'],
    background: "transparent",
    margin: 0,
    padding: 0,
    fontSize: "11px",
    lineHeight: "1.65",
    fontFamily: "var(--font-geist-mono), 'Geist Mono', monospace",
  },
  'code[class*="language-"]': {
    ...vscDarkPlus['code[class*="language-"]'],
    background: "transparent",
    fontSize: "11px",
    lineHeight: "1.65",
    fontFamily: "var(--font-geist-mono), 'Geist Mono', monospace",
  },
};

function FilePopout({
  content,
  filename,
  language,
  onClose,
}: {
  content: string;
  filename?: string;
  language?: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const lang = detectLanguage(filename, language);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 w-[70vw] max-w-4xl h-[75vh] flex flex-col bg-[#1e1e1e] rounded-btn shadow-2xl border border-[var(--color-border-default)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#333] flex-shrink-0 bg-[#252526]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[#ccc]">
              {filename ?? "file"}
            </span>
            {lang !== "text" && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#333] text-[#888] font-mono uppercase tracking-wide">
                {lang}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[#888] hover:text-[#ccc] transition-colors duration-fast"
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrollable code */}
        <div className="flex-1 overflow-auto p-4">
          <SyntaxHighlighter
            language={lang}
            style={HIGHLIGHTER_STYLE}
            showLineNumbers
            lineNumberStyle={{
              color: "#495057",
              fontSize: "10px",
              minWidth: "2.5em",
              paddingRight: "1.2em",
              userSelect: "none",
            }}
            wrapLongLines={false}
            customStyle={{ background: "transparent", margin: 0, padding: 0 }}
          >
            {content}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function CodePreview({
  content,
  filename,
  language,
  maxLines = 8,
  className = "",
}: CodePreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [popout, setPopout] = useState(false);

  const lang = detectLanguage(filename, language);
  const allLines = content.split("\n");
  const isTruncatable = allLines.length > maxLines;
  const displayContent = expanded
    ? content
    : allLines.slice(0, maxLines).join("\n");

  return (
    <>
      <div
        className={[
          "bg-[#1e1e1e] rounded-btn overflow-hidden relative group border border-[#2d2d2d]",
          className,
        ].join(" ")}
      >
        {/* Popout button */}
        <button
          onClick={() => setPopout(true)}
          aria-label="Open code in popout"
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-fast text-[#888] hover:text-[#ccc] bg-[#252526] rounded p-0.5 border border-[#333]"
        >
          <Maximize2 size={11} />
        </button>

        {/* Code */}
        <div
          className={[
            "p-3 overflow-x-auto",
            expanded ? "overflow-y-auto max-h-72" : "overflow-y-hidden",
          ].join(" ")}
        >
          <SyntaxHighlighter
            language={lang}
            style={HIGHLIGHTER_STYLE}
            wrapLongLines={false}
            customStyle={{ background: "transparent", margin: 0, padding: 0 }}
          >
            {displayContent}
          </SyntaxHighlighter>
        </div>

        {/* Expand/collapse */}
        {isTruncatable && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-center text-[10px] text-[#888] hover:text-[#bbb] py-1.5 border-t border-[#2d2d2d] bg-[#1e1e1e] transition-colors duration-fast"
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
          language={language}
          onClose={() => setPopout(false)}
        />
      )}
    </>
  );
}
