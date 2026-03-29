"use client";

import { useState } from "react";
import { X, Play } from "lucide-react";
import type { Candidate } from "@/lib/types";

interface StdinModalProps {
  modelLabel: string;
  candidate: Candidate;
  onRun: (stdin: string) => void;
  onCancel: () => void;
}

// Patterns to extract prompt strings from code
const PROMPT_PATTERNS = [
  /input\(\s*["'`](.+?)["'`]\s*\)/g,                         // Python: input("prompt")
  /System\.out\.print(?:ln)?\s*\(\s*["'](.+?)["']\s*\)/g,    // Java: System.out.println("prompt")
  /Console\.Write(?:Line)?\s*\(\s*["'](.+?)["']\s*\)/g,      // C#
  /printf\s*\(\s*["'](.+?)["']/g,                             // C: printf("prompt")
  /fmt\.Print(?:f|ln)?\s*\(\s*["'](.+?)["']/g,               // Go
  /puts\s+["'](.+?)["']/g,                                    // Ruby
  /question\s*\(\s*["'`](.+?)["'`]/g,                        // readline.question("prompt")
  /print\s*\(\s*["'](.+?)["']\s*,\s*end\s*=\s*["']["']\s*\)/g, // Python print(..., end='')
];

function extractPrompts(candidate: Candidate): string[] {
  const prompts: string[] = [];
  const seen = new Set<string>();

  for (const file of Object.values(candidate.files)) {
    for (const pattern of PROMPT_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(file.content)) !== null) {
        const prompt = match[1].trim();
        if (prompt && !seen.has(prompt)) {
          seen.add(prompt);
          prompts.push(prompt);
        }
      }
    }
  }
  return prompts;
}

export function StdinModal({ modelLabel, candidate, onRun, onCancel }: StdinModalProps) {
  const [stdin, setStdin] = useState("");
  const prompts = extractPrompts(candidate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 w-[520px] max-w-[92vw] bg-[var(--color-bg-primary)] border border-[var(--color-border-tertiary)] rounded-panel shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-tertiary)]">
          <div>
            <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">
              Program Input Required
            </span>
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
              {modelLabel} — enter all inputs before running
            </p>
          </div>
          <button onClick={onCancel} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">
            <X size={13} />
          </button>
        </div>

        {/* Prompts guide */}
        {prompts.length > 0 && (
          <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-tertiary)]">
            <p className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide mb-2">
              This program will ask for:
            </p>
            <ol className="space-y-1">
              {prompts.map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[10px] font-mono text-[var(--color-text-tertiary)] mt-0.5 flex-shrink-0">
                    {i + 1}.
                  </span>
                  <span className="text-[11px] text-[var(--color-text-secondary)] font-mono">
                    {p}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-2">
              If the program loops, add one answer per line for each time it asks.
            </p>
          </div>
        )}

        {/* Stdin input */}
        <div className="px-4 py-3">
          <label className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide mb-1.5 block">
            Your inputs — one per line
          </label>
          <textarea
            autoFocus
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder={prompts.length > 0
              ? prompts.slice(0, 3).join("\n") + (prompts.length > 3 ? "\n..." : "")
              : "Enter each input on its own line"
            }
            rows={Math.max(4, Math.min(prompts.length + 1, 8))}
            className="w-full bg-[#0d0d0d] border border-[var(--color-border-tertiary)] rounded-btn px-3 py-2 text-[12px] font-mono text-[#e2e2e2] placeholder:text-[#444] resize-none focus:outline-none focus:border-primary-blue"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--color-border-tertiary)]">
          <button
            onClick={onCancel}
            className="text-[11px] px-3 py-1.5 rounded-btn text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onRun(stdin)}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-btn bg-green-900/50 border border-green-800/60 text-green-400 hover:bg-green-900/80 transition-colors"
          >
            <Play size={10} />
            Run
          </button>
        </div>
      </div>
    </div>
  );
}
