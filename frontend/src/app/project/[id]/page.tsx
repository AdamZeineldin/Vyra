"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import type { Project } from "@/lib/types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-tertiary)] flex flex-col items-center justify-center gap-3">
      <Image src="/logo.png" alt="Vyra" width={40} height={40} className="opacity-40 animate-pulse" />
      <span className="text-[11px] text-[var(--color-text-tertiary)]">Loading project…</span>
    </div>
  );
}

function ErrorScreen({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-tertiary)] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <Image src="/logo.png" alt="Vyra" width={32} height={32} className="opacity-30 mx-auto mb-4" />
        <p className="text-[12px] text-warning-text mb-1">{message}</p>
        <p className="text-[11px] text-[var(--color-text-tertiary)] mb-4">
          The project may have been deleted or the server is unreachable.
        </p>
        <button
          onClick={onBack}
          className="text-[11px] text-primary-blue-text hover:underline"
        >
          ← Back to projects
        </button>
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setProject } = useWorkspaceStore();
  const [project, setLocalProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`${BACKEND_URL}/projects/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Project not found");
        return r.json();
      })
      .then((p: Project) => {
        setLocalProject(p);
        setProject(p);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <LoadingScreen />;
  if (error || !project) return <ErrorScreen message={error ?? "Project not found"} onBack={() => router.push("/")} />;

  return <WorkspaceShell project={project} />;
}
