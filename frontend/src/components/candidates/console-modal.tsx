"use client";

import { X } from "lucide-react";

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
  timed_out: boolean;
}

interface ConsoleModalProps {
  modelLabel: string;
  result: ExecutionResult;
  onClose: () => void;
}

export function ConsoleModal({ modelLabel, result, onClose }: ConsoleModalProps) {
  const success = result.exit_code === 0 && !result.timed_out;
  const hasStdout = result.stdout.trim().length > 0;
  const hasStderr = result.stderr.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 w-[640px] max-w-[92vw] max-h-[80vh] flex flex-col bg-[#0d0d0d] border border-[var(--color-border-tertiary)] rounded-panel shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e1e1e] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            </span>
            <span className="text-[11px] text-[#888] font-mono">
              {modelLabel} — console
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                result.timed_out
                  ? "bg-yellow-900/50 text-yellow-400"
                  : success
                  ? "bg-green-900/50 text-green-400"
                  : "bg-red-900/50 text-red-400"
              }`}
            >
              {result.timed_out
                ? "TIMED OUT"
                : `exit ${result.exit_code}`}
            </span>
            <span className="text-[10px] text-[#555] font-mono">
              {result.duration_ms}ms
            </span>
            <button
              onClick={onClose}
              className="text-[#555] hover:text-[#aaa] transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Console output */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-[12px] leading-relaxed space-y-1">
          {!hasStdout && !hasStderr && (
            <span className="text-[#555]">(no output)</span>
          )}
          {hasStdout &&
            result.stdout.split("\n").map((line, i) => (
              <div key={i} className="text-[#e2e2e2] whitespace-pre-wrap break-words">
                {line || "\u00A0"}
              </div>
            ))}
          {hasStderr && (
            <>
              {hasStdout && <div className="border-t border-[#1e1e1e] my-2" />}
              {result.stderr.split("\n").map((line, i) => (
                <div key={i} className="text-[#f87171] whitespace-pre-wrap break-words">
                  {line || "\u00A0"}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
