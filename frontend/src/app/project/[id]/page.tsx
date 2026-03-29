"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { getUserId } from "@/lib/user-id";
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
  const searchParams = useSearchParams();
  const { setProject, setPrompt, generate } = useWorkspaceStore();
  const { data: session, status } = useSession();

  const [project, setLocalProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track whether we've fired the initial auto-generate
  const autoGenFired = useRef(false);

  useEffect(() => {
    if (!id || status === "loading") return;
    // Reset state so a route change to a different project starts fresh
    setLocalProject(null);
    setLoading(true);
    setError(null);
    autoGenFired.current = false;

    const userId = getUserId(session);
    fetch(`${BACKEND_URL}/projects/${id}?user_id=${encodeURIComponent(userId)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Project not found");
        return r.json();
      })
      .then((p: Project) => {
        setLocalProject(p);
        setProject(p);
      })
      .catch(() => router.replace("/"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, status]);

  // Auto-generate from URL params once project is loaded
  useEffect(() => {
    if (!project || autoGenFired.current) return;
    const initialPrompt = searchParams.get("prompt");
    const modelParam = searchParams.get("models");
    if (!initialPrompt) return;

    autoGenFired.current = true;
    const modelIds = modelParam ? modelParam.split(",").filter(Boolean) : [];

    setPrompt(initialPrompt);
    // Clear URL params without re-render
    router.replace(`/project/${id}`, { scroll: false });
    // generate reads prompt from store — setPrompt is synchronous in Zustand
    generate(modelIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  if (loading) return <LoadingScreen />;
  if (error || !project) return <ErrorScreen message={error ?? "Project not found"} onBack={() => router.push("/")} />;

  return <WorkspaceShell project={project} />;
}
