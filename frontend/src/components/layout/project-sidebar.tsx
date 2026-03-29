"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import {
  SquarePen,
  Trash2,
  UserCircle,
  Settings,
  X,
  LogOut,
  GitBranch,
} from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useProjectStore } from "@/stores/project-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { getUserId } from "@/lib/user-id";

interface GitHubStatus {
  connected: boolean;
  username?: string;
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 w-[520px] max-w-[90vw] bg-[var(--color-bg-primary)] border border-[var(--color-border-tertiary)] rounded-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-tertiary)]">
          <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
            Settings
          </span>
          <button
            onClick={onClose}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors duration-fast"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-8">
          <p className="text-[12px] text-[var(--color-text-tertiary)] text-center">
            Settings coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProfilePopup({
  name,
  image,
  onClose,
  onSignOut,
}: {
  name: string;
  image?: string | null;
  onClose: () => void;
  onSignOut: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-start"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 mb-[60px] ml-3 w-52 bg-[var(--color-bg-primary)] border border-[var(--color-border-tertiary)] rounded-panel shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* User info */}
        <div className="flex items-center gap-2.5 px-3 py-3 border-b border-[var(--color-border-tertiary)]">
          {image ? (
            <Image
              src={image}
              alt={name}
              width={28}
              height={28}
              className="rounded-full flex-shrink-0"
            />
          ) : (
            <UserCircle
              size={28}
              className="flex-shrink-0 text-[var(--color-text-tertiary)]"
            />
          )}
          <span className="text-[12px] font-medium text-[var(--color-text-primary)] truncate">
            {name}
          </span>
        </div>

        {/* Actions */}
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors duration-fast"
        >
          <LogOut size={13} className="flex-shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export function ProjectSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { projects, isLoading, loadProjects, deleteProject, updateProjectName } =
    useProjectStore();
  const activeProject = useWorkspaceStore((s) => s.project);
  const { data: session, status } = useSession();

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    loadProjects(getUserId(session));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Keep project list name in sync with LLM-generated names from workspace store
  useEffect(() => {
    if (activeProject?.id && activeProject.name) {
      updateProjectName(activeProject.id, activeProject.name);
    }
  }, [activeProject?.id, activeProject?.name, updateProjectName]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/github/status")
      .then((r) => r.json())
      .then((d) => setGithubStatus(d as GitHubStatus))
      .catch(() => setGithubStatus({ connected: false }));
  }, [session]);

  const handleGitHubConnect = () => {
    window.location.href = `/api/github/connect?returnUrl=${encodeURIComponent(pathname)}`;
  };

  const handleGitHubDisconnect = async () => {
    await fetch("/api/github/status", { method: "DELETE" });
    setGithubStatus({ connected: false });
  };

  const currentProjectId = pathname.startsWith("/project/")
    ? pathname.split("/project/")[1]
    : null;

  return (
    <>
      <aside className="w-56 flex-shrink-0 h-screen flex flex-col bg-[var(--color-bg-primary)] border-r border-[var(--color-border-tertiary)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-[14px] flex-shrink-0 border-b border-[var(--color-border-tertiary)]">
          <button
            onClick={() => router.push("/")}
            className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity duration-fast"
          >
            <div className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Vyra"
                width={20}
                height={20}
                className="flex-shrink-0"
              />
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
            <p className="text-[11px] text-[var(--color-text-tertiary)] px-2 py-2">
              Loading…
            </p>
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
                <span className="flex-1 text-[12px] truncate">
                  {p.name}
                </span>

                {confirmDeleteId === p.id ? (
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        deleteProject(p.id, getUserId(session));
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

        {/* Profile / Settings footer */}
        <div className="flex-shrink-0 border-t border-[var(--color-border-tertiary)] px-3 py-2.5 space-y-1">
          {/* GitHub connect row — shown when signed in */}
          {session && (
            <div className="flex items-center gap-1.5 px-1.5 py-1">
              <GitBranch
                size={13}
                className={githubStatus?.connected ? "text-[#4ade80]" : "text-[var(--color-text-tertiary)]"}
              />
              {githubStatus?.connected ? (
                <>
                  <span className="text-[11px] text-[var(--color-text-secondary)] flex-1 truncate">
                    @{githubStatus.username}
                  </span>
                  <button
                    onClick={handleGitHubDisconnect}
                    className="text-[10px] text-[var(--color-text-tertiary)] hover:text-warning-text transition-colors"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={handleGitHubConnect}
                  className="text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  Connect GitHub
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                session
                  ? setProfileOpen(true)
                  : signIn("google", { callbackUrl: pathname })
              }
              className="flex items-center gap-2 flex-1 min-w-0 rounded-btn hover:bg-[var(--color-bg-secondary)] px-1.5 py-1 transition-colors duration-fast text-left"
            >
              {session?.user?.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name ?? "User"}
                  width={20}
                  height={20}
                  className="rounded-full flex-shrink-0"
                />
              ) : (
                <UserCircle
                  size={16}
                  className="flex-shrink-0 text-[var(--color-text-tertiary)]"
                />
              )}
              <span className="text-[12px] text-[var(--color-text-secondary)] truncate">
                {session?.user?.name ?? "Sign in"}
              </span>
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className="w-6 h-6 flex items-center justify-center rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors duration-fast flex-shrink-0"
              aria-label="Settings"
            >
              <Settings size={13} />
            </button>
          </div>
        </div>
      </aside>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {profileOpen && session?.user && (
        <ProfilePopup
          name={session.user.name ?? ""}
          image={session.user.image}
          onClose={() => setProfileOpen(false)}
          onSignOut={() => {
            setProfileOpen(false);
            signOut({ callbackUrl: "/" });
          }}
        />
      )}
    </>
  );
}
