"use client";

import { FileText } from "lucide-react";
import type { FileMap } from "@/lib/types";

interface FileExplorerProps {
  files: FileMap;
  selectedPath?: string;
  onSelectFile?: (path: string) => void;
}

export function FileExplorer({ files, selectedPath, onSelectFile }: FileExplorerProps) {
  const paths = Object.keys(files);

  if (paths.length === 0) {
    return (
      <div className="text-[10px] text-[var(--color-text-tertiary)] italic py-1">
        No files
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {paths.map((path) => (
        <button
          key={path}
          onClick={() => onSelectFile?.(path)}
          className={[
            "flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-node text-left w-full",
            "transition-colors duration-fast",
            selectedPath === path
              ? "bg-primary-blue-bg text-primary-blue-text"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]",
          ].join(" ")}
        >
          <FileText size={11} className="flex-shrink-0" />
          <span className="font-mono truncate">{path}</span>
        </button>
      ))}
    </div>
  );
}
