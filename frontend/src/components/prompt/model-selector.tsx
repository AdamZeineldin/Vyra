"use client";

import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import type { ModelConfig } from "@/lib/types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

interface ModelSelectorProps {
  selected: ModelConfig[];
  onChange: (models: ModelConfig[]) => void;
  autoSelectFirst?: boolean;
}

function getModelStyle(modelId: string): string {
  if (modelId.includes("anthropic") || modelId.includes("claude"))
    return "bg-claude-bg text-claude-text border border-orange-800/30";
  if (modelId.includes("grok") || modelId.includes("x-ai"))
    return "bg-grok-bg text-grok-text border border-purple-800/30";
  if (modelId.includes("google") || modelId.includes("gemini"))
    return "bg-gemini-bg text-gemini-text border border-yellow-800/30";
  if (modelId.includes("openai") || modelId.includes("gpt"))
    return "bg-openai-bg text-openai-text border border-green-800/30";
  return "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-secondary)]";
}

export function ModelSelector({ selected, onChange, autoSelectFirst }: ModelSelectorProps) {
  const [available, setAvailable] = useState<ModelConfig[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/models/`)
      .then((r) => r.json())
      .then((models: ModelConfig[]) => {
        setAvailable(models);
        if (autoSelectFirst && selected.length === 0 && models.length > 0) {
          onChange([models[0]]);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = (id: string) => onChange(selected.filter((m) => m.id !== id));
  const add = (model: ModelConfig) => {
    if (!selected.find((m) => m.id === model.id)) {
      onChange([...selected, model]);
    }
    setOpen(false);
  };

  const unselected = available.filter((m) => !selected.find((s) => s.id === m.id));

  return (
    <div className="flex items-center gap-1.5 flex-wrap relative">
      {selected.map((m) => (
        <span
          key={m.id}
          className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-pill ${getModelStyle(m.id)}`}
        >
          {m.label}
          <button
            onClick={() => remove(m.id)}
            className="opacity-60 hover:opacity-100 transition-opacity"
            aria-label={`Remove ${m.label}`}
          >
            <X size={9} />
          </button>
        </span>
      ))}

      {selected.length < 5 && (
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="inline-flex items-center gap-0.5 text-[10px] text-[var(--color-text-tertiary)] border border-dashed border-[var(--color-border-secondary)] px-1.5 py-0.5 rounded-pill hover:border-[var(--color-border-primary)] hover:text-[var(--color-text-secondary)] transition-colors duration-fast"
          >
            <Plus size={9} /> Add model
          </button>

          {open && unselected.length > 0 && (
            <div className="absolute top-6 left-0 z-50 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-panel shadow-lg min-w-48 py-1">
              {unselected.map((m) => (
                <button
                  key={m.id}
                  onClick={() => add(m)}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors duration-fast flex items-center gap-2"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getModelStyle(m.id).split(" ")[1]}`} />
                  {m.label}
                  <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">
                    {m.provider}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
