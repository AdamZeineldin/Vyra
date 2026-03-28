"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2 } from "lucide-react";
import { useProjectStore } from "@/stores/project-store";
import { ModelSelector } from "@/components/prompt/model-selector";
import type { ModelConfig } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

function truncateName(prompt: string, max = 60): string {
  const trimmed = prompt.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max).trimEnd() + "…";
}

export default function HomePage() {
  const router = useRouter();
  const { createProject } = useProjectStore();
  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState<ModelConfig[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load default models on mount
  useEffect(() => {
    fetch(`${BACKEND_URL}/models/`)
      .then((r) => r.json())
      .then((models: ModelConfig[]) => {
        if (models.length > 0) setSelectedModels([models[0]]);
      })
      .catch(() => {});
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [prompt]);

  const handleSubmit = async () => {
    if (!prompt.trim() || submitting) return;
    setSubmitting(true);
    const project = await createProject(truncateName(prompt));
    if (project) {
      const modelParam = selectedModels.map((m) => m.id).join(",");
      const promptParam = encodeURIComponent(prompt.trim());
      router.push(`/project/${project.id}?prompt=${promptParam}&models=${modelParam}`);
    } else {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = prompt.trim().length > 0 && selectedModels.length > 0 && !submitting;

  return (
    <div className="h-full min-h-screen bg-[var(--color-bg-tertiary)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* Heading */}
        <div className="text-center">
          <h1 className="text-[20px] font-semibold text-[var(--color-text-primary)] tracking-tight">
            What do you want to build?
          </h1>
          <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1">
            Describe your project and multiple models will generate candidates in parallel.
          </p>
        </div>

        {/* Prompt box */}
        <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border-secondary)] rounded-panel shadow-sm focus-within:border-primary-blue transition-colors duration-fast">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Build me a REST API that…"
            rows={4}
            className="w-full bg-transparent px-4 pt-4 pb-2 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] resize-none focus:outline-none font-sans leading-relaxed"
          />

          {/* Toolbar row */}
          <div className="flex items-center justify-between px-3 pb-3 gap-3">
            <ModelSelector selected={selectedModels} onChange={setSelectedModels} />
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-blue text-white disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex-shrink-0"
              aria-label="Submit"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ArrowUp size={14} />
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-[var(--color-text-tertiary)]">
          ⌘↵ to submit
        </p>
      </div>
    </div>
  );
}
