"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowUp, Loader2 } from "lucide-react";
import { useProjectStore } from "@/stores/project-store";
import { ModelSelector } from "@/components/prompt/model-selector";
import type { ModelConfig } from "@/lib/types";

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
      const params = new URLSearchParams();
      params.set("prompt", prompt.trim());
      params.set("models", selectedModels.map((m) => m.id).join(","));
      router.push(`/project/${project.id}?${params.toString()}`);
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
        {/* Branding */}
        <div className="flex items-center justify-center gap-2">
          <Image src="/logo.png" alt="Vyra" width={104} height={104} />
          <h1 className="text-[108px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            Vyra
          </h1>
        </div>

        {/* Heading */}
        <div className="text-center">
          <h2 className="text-[20px] font-semibold text-[var(--color-text-primary)] tracking-tight">
            What do you want to build?
          </h2>
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
            <ModelSelector selected={selectedModels} onChange={setSelectedModels} autoSelectFirst />
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
