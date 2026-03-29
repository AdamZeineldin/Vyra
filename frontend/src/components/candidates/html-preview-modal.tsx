"use client";

import { useEffect, useCallback } from "react";
import { X, ExternalLink } from "lucide-react";
import type { Candidate } from "@/lib/types";

interface HtmlPreviewModalProps {
  candidate: Candidate;
  onClose: () => void;
}

/** Inline all CSS <link> and JS <script src=...> references found in the file map. */
function bundleHtml(files: Candidate["files"]): string {
  const htmlPath =
    Object.keys(files).find((p) => p === "index.html") ??
    Object.keys(files).find((p) => p.endsWith(".html"));

  if (!htmlPath) return "<html><body><p>No HTML file found.</p></body></html>";

  let html = files[htmlPath].content;

  for (const [path, entry] of Object.entries(files)) {
    const filename = path.split("/").pop()!;

    if (path.endsWith(".css")) {
      // Replace <link rel="stylesheet" href="filename.css"> with inline <style>
      html = html.replace(
        new RegExp(`<link[^>]*href=["']${escapeRegex(filename)}["'][^>]*>`, "gi"),
        `<style>${entry.content}</style>`
      );
    }

    if (path.endsWith(".js")) {
      // Replace <script src="filename.js"></script> with inline <script>
      html = html.replace(
        new RegExp(
          `<script[^>]*src=["']${escapeRegex(filename)}["'][^>]*>\\s*</script>`,
          "gi"
        ),
        `<script>${entry.content}</script>`
      );
    }
  }

  return html;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function HtmlPreviewModal({ candidate, onClose }: HtmlPreviewModalProps) {
  const bundled = bundleHtml(candidate.files);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const openInNewTab = useCallback(() => {
    const blob = new Blob([bundled], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    // Revoke after the tab has loaded
    if (win) {
      win.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
    }
  }, [bundled]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 flex flex-col bg-[#0d0d0d] border border-[var(--color-border-tertiary)] rounded-panel shadow-2xl overflow-hidden"
        style={{ width: "min(860px, 94vw)", height: "min(640px, 88vh)" }}
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
              {candidate.modelLabel} — preview
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={openInNewTab}
              title="Open in new tab"
              aria-label="Open in new tab"
              className="text-[#555] hover:text-[#aaa] transition-colors"
            >
              <ExternalLink size={13} />
            </button>
            <button
              onClick={onClose}
              aria-label="Close preview"
              className="text-[#555] hover:text-[#aaa] transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Preview iframe */}
        <iframe
          srcDoc={bundled}
          title="HTML preview"
          className="flex-1 w-full bg-white"
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
        />
      </div>
    </div>
  );
}
