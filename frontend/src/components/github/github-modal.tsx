"use client";

import { useState, useEffect, useRef } from "react";
import { X, GitBranch, ExternalLink, Loader2 } from "lucide-react";
import type { FileMap } from "@/lib/types";

export type GitHubModalMode = "create" | "commit";

interface GitHubStatus {
  connected: boolean;
  username?: string;
}

interface GitHubModalProps {
  mode: GitHubModalMode;
  files: FileMap;
  projectName: string;
  projectId: string;
  onRepoCreated?: () => void;
  onClose: () => void;
}

function toRepoSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/, "");
}

function filesAsRecord(files: FileMap): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([path, entry]) => [path, entry.content])
  );
}

function getStoredRepo(projectId: string): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(`vyra_gh_repo_${projectId}`) ?? "";
}

function storeRepo(projectId: string, repoFullName: string): void {
  localStorage.setItem(`vyra_gh_repo_${projectId}`, repoFullName);
}

export function GitHubModal({
  mode,
  files,
  projectName,
  projectId,
  onRepoCreated,
  onClose,
}: GitHubModalProps) {
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [repoName, setRepoName] = useState(() =>
    mode === "create" ? toRepoSlug(projectName) : getStoredRepo(projectId)
  );
  const [isPrivate, setIsPrivate] = useState(false);
  const [description, setDescription] = useState("");
  const [commitMessage, setCommitMessage] = useState("Update files from Vyra");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/github/status")
      .then((r) => r.json())
      .then((data) => setStatus(data as GitHubStatus))
      .catch(() => setStatus({ connected: false }));
  }, []);

  const handleConnect = () => {
    window.location.href = `/api/github/connect?returnUrl=${encodeURIComponent(window.location.pathname)}`;
  };

  const handleCreate = async () => {
    const slugged = toRepoSlug(repoName.trim());
    if (!slugged) return;
    setRepoName(slugged);
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/github/create-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: slugged,
          private: isPrivate,
          description,
          files: filesAsRecord(files),
        }),
      });
      const data = await res.json() as { success?: boolean; repoUrl?: string; repoFullName?: string; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to create repository");
        return;
      }
      if (data.repoFullName) {
        storeRepo(projectId, data.repoFullName);
        onRepoCreated?.();
      }
      setSuccessUrl(data.repoUrl ?? null);
    } catch {
      setError("Network error — please try again");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommit = async () => {
    if (!repoName.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/github/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName: repoName.trim(),
          message: commitMessage.trim() || "Update files from Vyra",
          files: filesAsRecord(files),
        }),
      });
      const data = await res.json() as { success?: boolean; commitUrl?: string; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to commit");
        return;
      }
      storeRepo(projectId, repoName.trim());
      setSuccessUrl(data.commitUrl ?? null);
    } catch {
      setError("Network error — please try again");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fileCount = Object.keys(files).length;
  const isLoading = status === null;
  const mouseDownOnBackdrop = useRef(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onMouseDown={(e) => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && mouseDownOnBackdrop.current) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 w-[460px] max-w-[90vw] bg-[var(--color-bg-primary)] border border-[var(--color-border-tertiary)] rounded-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-tertiary)]">
          <div className="flex items-center gap-2">
            <GitBranch size={15} className="text-[var(--color-text-secondary)]" />
            <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
              {mode === "create" ? "Create GitHub Repository" : "Commit to GitHub"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors duration-fast"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={16} className="animate-spin text-[var(--color-text-tertiary)]" />
            </div>
          )}

          {/* Not connected */}
          {!isLoading && !status?.connected && (
            <div className="text-center py-4 space-y-3">
              <GitBranch size={32} className="mx-auto text-[var(--color-text-tertiary)]" />
              <div>
                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                  Connect your GitHub account
                </p>
                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                  Authorize Vyra to create repositories and commit code on your behalf.
                </p>
              </div>
              <button
                onClick={handleConnect}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-text-primary)] text-[var(--color-bg-primary)] text-[12px] font-medium rounded-btn hover:opacity-90 transition-opacity"
              >
                <GitBranch size={13} />
                Connect GitHub
              </button>
            </div>
          )}

          {/* Success */}
          {!isLoading && status?.connected && successUrl && (
            <div className="text-center py-4 space-y-3">
              <div className="w-8 h-8 rounded-full bg-[#1a2e1a] border border-[#2d5a2d] flex items-center justify-center mx-auto">
                <span className="text-[#4ade80] text-[14px]">✓</span>
              </div>
              <div>
                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                  {mode === "create" ? "Repository created!" : "Committed successfully!"}
                </p>
                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                  {fileCount} file{fileCount !== 1 ? "s" : ""} pushed.
                </p>
              </div>
              <a
                href={successUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-primary-blue)] hover:underline"
              >
                View on GitHub
                <ExternalLink size={11} />
              </a>
            </div>
          )}

          {/* Form — Create mode */}
          {!isLoading && status?.connected && !successUrl && mode === "create" && (
            <>
              <div className="text-[11px] text-[var(--color-text-tertiary)]">
                Connected as <span className="font-medium text-[var(--color-text-secondary)]">@{status.username}</span>
                {" · "}
                {fileCount} file{fileCount !== 1 ? "s" : ""} will be pushed
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">
                    Repository name
                  </label>
                  <input
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    onBlur={(e) => setRepoName(toRepoSlug(e.target.value) || toRepoSlug(projectName))}
                    className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] rounded-btn px-3 py-1.5 text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-primary-blue)] transition-colors"
                    placeholder="my-project"
                  />
                  <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">Spaces and special characters will be converted to hyphens on save.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">
                    Description <span className="font-normal text-[var(--color-text-tertiary)]">(optional)</span>
                  </label>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] rounded-btn px-3 py-1.5 text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-primary-blue)] transition-colors"
                    placeholder="Generated by Vyra"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-[12px] text-[var(--color-text-secondary)]">Private repository</span>
                </label>
              </div>

              {error && (
                <p className="text-[11px] text-warning-text bg-warning-bg rounded-btn px-3 py-2">
                  {error}
                </p>
              )}

              <button
                onClick={handleCreate}
                disabled={!toRepoSlug(repoName.trim()) || isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2 bg-[var(--color-text-primary)] text-[var(--color-bg-primary)] text-[12px] font-medium rounded-btn hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {isSubmitting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <GitBranch size={13} />
                )}
                {isSubmitting ? "Creating…" : "Create repository"}
              </button>
            </>
          )}

          {/* Form — Commit mode */}
          {!isLoading && status?.connected && !successUrl && mode === "commit" && (
            <>
              <div className="text-[11px] text-[var(--color-text-tertiary)]">
                Connected as <span className="font-medium text-[var(--color-text-secondary)]">@{status.username}</span>
                {" · "}
                {fileCount} file{fileCount !== 1 ? "s" : ""} will be committed
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">
                    Repository <span className="font-normal text-[var(--color-text-tertiary)]">(owner/repo)</span>
                  </label>
                  <input
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] rounded-btn px-3 py-1.5 text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-primary-blue)] transition-colors"
                    placeholder="username/my-project"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">
                    Commit message
                  </label>
                  <input
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] rounded-btn px-3 py-1.5 text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-primary-blue)] transition-colors"
                    placeholder="Update files from Vyra"
                  />
                </div>
              </div>

              {error && (
                <p className="text-[11px] text-warning-text bg-warning-bg rounded-btn px-3 py-2">
                  {error}
                </p>
              )}

              <button
                onClick={handleCommit}
                disabled={!repoName.trim() || isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2 bg-[var(--color-text-primary)] text-[var(--color-bg-primary)] text-[12px] font-medium rounded-btn hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {isSubmitting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <GitBranch size={13} />
                )}
                {isSubmitting ? "Committing…" : "Commit to GitHub"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
