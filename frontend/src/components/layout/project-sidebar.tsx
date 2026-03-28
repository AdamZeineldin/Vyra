"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { SquarePen, Trash2 } from "lucide-react";
import { useProjectStore } from "@/stores/project-store";

export function ProjectSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { projects, isLoading, loadProjects, deleteProject } = useProjectStore();

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentProjectId = pathname.startsWith("/project/")
    ? pathname.split("/project/")[1]
    : null;


  return (
    <aside className="w-56 flex-shrink-0 h-screen flex flex-col bg-[var(--color-bg-primary)] border-r border-[var(--color-border-tertiary)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-[14px] flex-shrink-0 border-b border-[var(--color-border-tertiary)]">
        <button
          onClick={() => router.push("/")}
          className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity duration-fast"
        >
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Vyra" width={20} height={20} className="flex-shrink-0" />
            <span className="text-[13px] font-semibold text-[var(--color-text-primary)] tracking-tight">
              Vyra
            </span>
          </div>
          <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 pl-[28px]">
            Start new project
          </p>
        </button>
        <button
          onClick={() => router.push("/")}
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors duration-fast flex-shrink-0"
          aria-label="New project"
        >
          <SquarePen size={13} />
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] px-2 mb-1.5">
          Projects
        </p>


        {isLoading && (
          <p className="text-[11px] text-[var(--color-text-tertiary)] px-2 py-2">Loading…</p>
        )}

        {!isLoading && projects.length === 0 && (
          <p className="text-[11px] text-[var(--color-text-tertiary)] px-2 py-2">
            No projects yet.
          </p>
        )}

        {projects.map((p) => {
          const isActive = p.id === currentProjectId;
          return (
            <div
              key={p.id}
              className={`group flex items-center gap-2 px-2 py-1.5 rounded-btn cursor-pointer transition-colors duration-fast ${
                isActive
                  ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
              onClick={() => router.push(`/project/${p.id}`)}
            >
              <span className="flex-1 text-[12px] truncate">{p.name}</span>

              {confirmDeleteId === p.id ? (
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      deleteProject(p.id);
                      setConfirmDeleteId(null);
                    }}
                    className="text-[10px] text-warning-text hover:underline font-medium"
                  >
                    Del
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="text-[10px] text-[var(--color-text-tertiary)] hover:underline"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(p.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-warning-text transition-all duration-fast"
                  aria-label="Delete project"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
