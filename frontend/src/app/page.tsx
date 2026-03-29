"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useProjectStore } from "@/stores/project-store";
import { ModelSelector } from "@/components/prompt/model-selector";
import { getUserId } from "@/lib/user-id";
import type { ModelConfig, WorkspaceMode } from "@/lib/types";
import { MODES } from "@/lib/modes";

const FULL_NAME = "Vyra";

export default function HomePage() {
  const router = useRouter();
  const { createProject } = useProjectStore();
  const { data: session } = useSession();
  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState<ModelConfig[]>([]);
  const [selectedMode, setSelectedMode] = useState<WorkspaceMode>("user");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [typedName, setTypedName] = useState("");
  useEffect(() => {
    if (typedName.length >= FULL_NAME.length) return;
    const timer = setTimeout(
      () => setTypedName(FULL_NAME.slice(0, typedName.length + 1)),
      typedName.length === 0 ? 120 : 90
    );
    return () => clearTimeout(timer);
  }, [typedName]);

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
    const project = await createProject("New Project", getUserId(session));
    if (project) {
      const params = new URLSearchParams();
      params.set("prompt", prompt.trim());
      params.set("models", selectedModels.map((m) => m.id).join(","));
      params.set("mode", selectedMode);
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
        <div className="flex justify-center">
          <h1 className="text-[108px] font-semibold tracking-tight text-[#6fcf3e] inline-flex items-end gap-[8px]">
            {typedName}
            <span
              className="inline-block bg-[#6fcf3e] animate-[blink_1s_step-end_infinite]"
              style={{ width: "0.55em", height: "5px", marginBottom: "0.22em", flexShrink: 0 }}
            />
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

        {/* Mode selector */}
        <div className="flex gap-2">
          {MODES.map((m) => {
            const active = selectedMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMode(m.id)}
                className={`flex-1 flex flex-col items-start px-3 py-2.5 rounded-panel border text-left transition-colors duration-fast ${
                  active
                    ? "border-[#6fcf3e] bg-[#6fcf3e12]"
                    : "border-[var(--color-border-tertiary)] bg-[var(--color-bg-primary)] hover:border-[var(--color-border-secondary)]"
                }`}
              >
                <span className={`text-[12px] font-semibold ${active ? "text-[#6fcf3e]" : "text-[var(--color-text-primary)]"}`}>
                  {m.label}
                </span>
                <span className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                  {m.description}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-center text-[11px] text-[var(--color-text-tertiary)]">
          ⌘↵ to submit
        </p>
      </div>
    </div>
  );
}
