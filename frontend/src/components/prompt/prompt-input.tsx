"use client";

import { KeyboardEvent, ReactNode } from "react";
import { Send, Loader2 } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { SectionLabel } from "@/components/ui/section-label";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface PromptInputProps {
  modelIds: string[];
  currentVersionLabel?: string;
  modelSelector?: ReactNode;
}

export function PromptInput({
  modelIds,
  currentVersionLabel,
  modelSelector,
}: PromptInputProps) {
  const { prompt, setPrompt, generate, isGenerating, currentVersion } =
    useWorkspaceStore();

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  };

  const handleSend = () => {
    if (!prompt.trim() || isGenerating) return;
    generate(modelIds);
  };

  const contextLabel =
    currentVersionLabel ?? (currentVersion ? "Current version" : "New project");

  return (
    <Panel padding="md">
      <SectionLabel number="04" className="mb-3">
        Next prompt
      </SectionLabel>

      {/* Base context indicator */}
      <div className="flex items-center gap-1.5 mb-3 text-[11px] text-[var(--color-text-tertiary)]">
        <span>Base context:</span>
        <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-sm bg-primary-blue-bg text-primary-blue-text border border-primary-blue-border">
          {contextLabel}
        </span>
        <span className="text-[10px]">· All models inherit this output</span>
      </div>

      {/* Textarea */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe the next change…"
        rows={3}
        className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] rounded-btn px-3 py-2 text-[12px] text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-tertiary)] resize-none focus:outline-none focus:border-primary-blue transition-colors duration-fast font-sans"
      />

      {/* Model selector + footer */}
      {modelSelector && <div className="mt-2.5 mb-2">{modelSelector}</div>}
      <div className="flex items-center justify-between mt-2.5">
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          {modelIds.length} model{modelIds.length !== 1 ? "s" : ""} respond in parallel · ⌘↵ to send
        </span>
        <Button
          variant="primary"
          size="md"
          onClick={handleSend}
          disabled={!prompt.trim() || isGenerating}
        >
          {isGenerating ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Send size={11} />
          )}
          Send to all
        </Button>
      </div>
    </Panel>
  );
}
