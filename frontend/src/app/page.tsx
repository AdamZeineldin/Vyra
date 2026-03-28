"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useProjectStore } from "@/stores/project-store";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export default function HomePage() {
  const router = useRouter();
  const { projects, isLoading, loadProjects, createProject, deleteProject } = useProjectStore();
  const [newName, setNewName] = useState("");
  const [runtime, setRuntime] = useState<"node" | "python">("node");
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const project = await createProject(newName.trim(), runtime);
    setCreating(false);
    if (project) {
      setNewName("");
      router.push(`/project/${project.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-tertiary)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo + branding */}
        <div className="flex flex-col items-center mb-10">
          <Image
            src="/logo.png"
            alt="Vyra"
            width={72}
            height={72}
            className="mb-4"
          />
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            Vyra
          </h1>
          <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1">
            Multi-model iterative code generation
          </p>
        </div>

        {/* New project form */}
        <Panel padding="md" className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] mb-3">
            New project
          </p>
          <div className="flex flex-col gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Project name…"
              className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] rounded-btn px-3 py-2 text-[13px] text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-primary-blue transition-colors duration-fast"
            />
            <div className="flex gap-2">
              <select
                value={runtime}
                onChange={(e) => setRuntime(e.target.value as "node" | "python")}
                className="flex-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] rounded-btn px-3 py-2 text-[13px] text-[var(--color-text-secondary)] focus:outline-none"
              >
                <option value="node">Node.js</option>
                <option value="python">Python</option>
              </select>
              <Button
                variant="primary"
                size="md"
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
              >
                <Plus size={13} />
                {creating ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        </Panel>

        {/* Project list */}
        {(isLoading || projects.length > 0) && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] mb-2 px-1">
              Recent projects
            </p>

            {isLoading && (
              <div className="text-[12px] text-[var(--color-text-tertiary)] py-4 text-center">
                Loading…
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              {projects.map((p) => (
                <Panel key={p.id} padding="sm">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => router.push(`/project/${p.id}`)}
                      className="flex items-center gap-2.5 flex-1 text-left hover:opacity-80 transition-opacity duration-fast"
                    >
                      <Image src="/logo.png" alt="" width={16} height={16} className="opacity-60" />
                      <div>
                        <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
                          {p.name}
                        </span>
                        <span className="ml-2 text-[11px] text-[var(--color-text-tertiary)]">
                          {p.runtime}
                        </span>
                      </div>
                    </button>
                    {confirmDeleteId === p.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-warning-text">Delete?</span>
                        <button
                          onClick={() => { deleteProject(p.id); setConfirmDeleteId(null); }}
                          className="text-[10px] text-warning-text hover:underline font-medium"
                        >
                          Yes
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
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="text-[var(--color-text-tertiary)] hover:text-warning-text transition-colors duration-fast p-1"
                        aria-label="Delete project"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </Panel>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
